from __future__ import annotations

import unittest
from dataclasses import replace
from contextlib import redirect_stdout
from io import StringIO
from json import loads
from tempfile import TemporaryDirectory
from pathlib import Path

from backend.simulation import (
    EventKind,
    GeneratorConfig,
    MissionConfig,
    MissionPriority,
    ScheduledEvent,
    SimulationEngine,
    SimulationConfig,
    StationConfig,
)
from backend.simulation.scenarios import build_scenario
from backend.simulation.cli import main as cli_main


class SimulationAcceptanceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = SimulationEngine()

    def test_normal_thirty_day_run_has_valid_state_and_balanced_energy(self) -> None:
        result = self.engine.run(build_scenario("normal", days=30, seed=101))
        self.assertEqual(result.summary["duration_hours"], 720)
        self.assertLessEqual(result.summary["energy_balance_max_error_kw"], 1e-6)
        self.assertEqual(result.summary["critical_violation_hours"], 0)
        self.assertGreaterEqual(result.summary["battery_min_kwh"], 90)
        self.assertGreaterEqual(result.summary["fuel_remaining_liters"], 0)
        self.assertEqual(len(result.telemetry), 720)

    def test_battery_capacity_loss_reduces_capacity_and_preserves_limits(self) -> None:
        config = build_scenario("battery_capacity_loss", days=30, seed=12)
        result = self.engine.run(config)
        self.assertAlmostEqual(config.station.battery.capacity_kwh, 252)
        self.assertAlmostEqual(config.station.battery.initial_kwh, 189)
        self.assertAlmostEqual(config.station.battery.reserve_kwh, 63)
        self.assertGreaterEqual(result.summary["battery_min_kwh"], 63)
        self.assertLessEqual(result.summary["battery_final_kwh"], 252)

    def test_fixed_seed_reproduces_full_result(self) -> None:
        config = build_scenario("storm", days=12, seed=77)
        self.assertEqual(self.engine.run(config).to_dict(), self.engine.run(config).to_dict())

    def test_different_seed_changes_weather_trajectory(self) -> None:
        first = self.engine.run(build_scenario("normal", days=4, seed=42))
        second = self.engine.run(build_scenario("normal", days=4, seed=43))
        self.assertNotEqual(
            [row["weather_regime"] for row in first.telemetry],
            [row["weather_regime"] for row in second.telemetry],
        )

    def test_solar_generation_uses_utc_for_equivalent_start_instants(self) -> None:
        utc_config = SimulationConfig(days=1, seed=55, start_time="2032-01-01T00:00:00+00:00")
        offset_config = replace(utc_config, start_time="2032-01-01T05:30:00+05:30")
        utc_result = self.engine.run(utc_config)
        offset_result = self.engine.run(offset_config)
        self.assertEqual(
            [row["solar_kw"] for row in utc_result.telemetry],
            [row["solar_kw"] for row in offset_result.telemetry],
        )

    def test_storm_reduces_renewables_and_defers_exposed_mission(self) -> None:
        result = self.engine.run(build_scenario("storm", days=10, seed=8))
        event = next(item for item in result.event_log if item["kind"] == EventKind.STORM.value)
        storm_hour = next(row["hour"] for row in result.telemetry if row["timestamp"] == event["timestamp"])
        before = result.telemetry[storm_hour - 1]
        during = result.telemetry[storm_hour]
        self.assertEqual(during["weather_regime"], "storm")
        self.assertLess(during["renewable_kw"], before["renewable_kw"])
        field_mission = next(item for item in result.mission_results if item["id"] == "storm-field-survey")
        self.assertEqual(field_mission["status"], "deferred")
        self.assertIn("Visibility", field_mission["reason"] or "")

    def test_generator_failure_uses_remaining_assets_and_recovers(self) -> None:
        result = self.engine.run(build_scenario("generator_failure", days=10, seed=9))
        self.assertTrue(any(item["kind"] == "generator_failure" for item in result.event_log))
        self.assertTrue(any(item["kind"] == "generator_recovered" for item in result.event_log))
        failed_rows = [row for row in result.telemetry if row["generator_status"]["gen-1"] == "failed"]
        self.assertTrue(failed_rows)
        self.assertTrue(any(row["generator_output_kw"]["gen-2"] > 0 for row in failed_rows))
        self.assertTrue(all(not row["critical_violation"] for row in failed_rows))

    def test_overlapping_generator_failures_do_not_recover_early(self) -> None:
        events = (
            ScheduledEvent("long-failure", EventKind.GENERATOR_FAILURE, 2,
                           duration_hours=6, target="gen-1"),
            ScheduledEvent("overlap", EventKind.GENERATOR_FAILURE, 4,
                           duration_hours=1, target="gen-1"),
        )
        result = self.engine.run(SimulationConfig(days=1, events=events))
        self.assertTrue(all(
            result.telemetry[hour]["generator_status"]["gen-1"] == "failed"
            for hour in range(2, 8)
        ))
        recovered = next(
            event for event in result.event_log
            if event["kind"] == "generator_recovered" and event["subject"] == "gen-1"
        )
        self.assertEqual(recovered["timestamp"], result.telemetry[8]["timestamp"])

    def test_resupply_delay_moves_arrival_and_is_recorded(self) -> None:
        result = self.engine.run(build_scenario("resupply_delay", days=30, seed=21))
        delay = next(item for item in result.event_log if item["kind"] == "resupply_delay")
        self.assertIn("new arrival hour is 408", delay["message"])
        arrival = next(item for item in result.event_log if item["kind"] == "resupply_arrived")
        arrival_hour = next(row["hour"] for row in result.telemetry if row["timestamp"] == arrival["timestamp"])
        self.assertEqual(arrival_hour, 408)
        last_pre_arrival = result.telemetry[arrival_hour - 1]
        minimum_generator_fuel = min(
            generator.minimum_kw * generator.liters_per_kwh
            for generator in build_scenario("resupply_delay", days=30, seed=21).station.generators
        )
        self.assertLess(last_pre_arrival["fuel_liters"], minimum_generator_fuel)
        self.assertIn("fuel_insufficient_for_minimum", last_pre_arrival["generator_status"].values())
        self.assertGreater(result.summary["unserved_energy_kwh"], 0)
        self.assertGreater(result.summary["critical_violation_hours"], 0)

    def test_mission_energy_is_power_times_duration(self) -> None:
        result = self.engine.run(build_scenario("mission_energy", days=2, seed=12))
        mission = result.mission_results[0]
        self.assertEqual(mission["required_energy_kwh"], 320)
        self.assertEqual(mission["status"], "completed")
        self.assertEqual(mission["served_energy_kwh"], 320)

    def test_high_power_mission_changes_battery_and_fuel_trajectories(self) -> None:
        with_mission_config = build_scenario("mission_energy", days=3, seed=12)
        without_mission_config = replace(
            with_mission_config,
            station=replace(with_mission_config.station, missions=()),
        )
        with_mission = self.engine.run(with_mission_config)
        without_mission = self.engine.run(without_mission_config)
        self.assertEqual(with_mission.mission_results[0]["required_energy_kwh"], 320)
        self.assertEqual(with_mission.mission_results[0]["served_energy_kwh"], 320)
        self.assertNotEqual(
            [row["battery_kwh"] for row in with_mission.telemetry],
            [row["battery_kwh"] for row in without_mission.telemetry],
        )
        self.assertNotEqual(
            [row["fuel_liters"] for row in with_mission.telemetry],
            [row["fuel_liters"] for row in without_mission.telemetry],
        )

    def test_generator_does_not_run_below_minimum_when_fuel_is_insufficient(self) -> None:
        station = StationConfig(
            solar_capacity_kw=0,
            wind_capacity_kw=0,
            battery=replace(StationConfig().battery, initial_kwh=90),
            generators=(GeneratorConfig("g", "Generator", 100, 18, 0.28),),
            initial_fuel_liters=1,
            fuel_capacity_liters=10,
            fuel_resupply=None,
        )
        result = self.engine.run(SimulationConfig(days=1, station=station))
        first = result.telemetry[0]
        self.assertEqual(first["generator_output_kw"]["g"], 0)
        self.assertEqual(first["generator_status"]["g"], "fuel_insufficient_for_minimum")
        self.assertEqual(first["fuel_liters"], 1)
        for row in result.telemetry:
            output = row["generator_output_kw"]["g"]
            if row["generator_status"]["g"] == "running":
                self.assertGreaterEqual(output, 18)

    def test_shared_personnel_and_equipment_prevent_collision(self) -> None:
        missions = (
            MissionConfig("a", "Mission A", 4, 2, 3, MissionPriority.HIGH,
                          equipment=("spectrometer",), personnel=("scientist",)),
            MissionConfig("b", "Mission B", 4, 2, 3, MissionPriority.LOW,
                          equipment=("spectrometer",), personnel=("scientist-2",)),
        )
        config = SimulationConfig(days=1, station=StationConfig(missions=missions))
        results = self.engine.run(config).mission_results
        self.assertEqual(results[0]["status"], "completed")
        self.assertEqual(results[1]["status"], "deferred")
        self.assertIn("equipment", results[1]["reason"] or "")

    def test_shared_personnel_prevents_collision(self) -> None:
        missions = (
            MissionConfig("a", "Mission A", 4, 2, 3, MissionPriority.HIGH,
                          personnel=("scientist",)),
            MissionConfig("b", "Mission B", 4, 2, 3, MissionPriority.LOW,
                          personnel=("scientist",)),
        )
        result = self.engine.run(
            SimulationConfig(days=1, station=StationConfig(missions=missions))
        )
        self.assertEqual(result.mission_results[0]["status"], "completed")
        self.assertEqual(result.mission_results[1]["status"], "deferred")
        self.assertIn("personnel", result.mission_results[1]["reason"] or "")

    def test_battery_never_charges_and_discharges_in_same_hour(self) -> None:
        result = self.engine.run(build_scenario("storm", days=8, seed=66))
        for row in result.telemetry:
            self.assertFalse(row["battery_charge_kw"] > 0 and row["battery_discharge_kw"] > 0)
            self.assertGreaterEqual(row["battery_kwh"], 90 - 1e-8)
            self.assertLessEqual(row["battery_kwh"], 360 + 1e-8)

    def test_critical_violation_is_explicit_when_station_cannot_supply_critical_load(self) -> None:
        station = StationConfig(
            solar_capacity_kw=0,
            wind_capacity_kw=0,
            battery=replace(
                StationConfig().battery,
                initial_kwh=90,
                max_discharge_kw=5,
            ),
            generators=(),
            initial_fuel_liters=0,
            fuel_capacity_liters=1,
            fuel_resupply=None,
        )
        result = self.engine.run(SimulationConfig(days=1, station=station))
        self.assertTrue(result.telemetry[0]["critical_violation"])
        self.assertGreater(result.telemetry[0]["load_breakdown"]["critical"]["shed_kw"], 0)

    def test_config_rejects_invalid_capacity_and_duplicate_event_ids(self) -> None:
        with self.assertRaises(ValueError):
            SimulationConfig(station=StationConfig(initial_fuel_liters=11000)).validate()
        duplicate_events = (
            ScheduledEvent("same", EventKind.STORM, 1),
            ScheduledEvent("same", EventKind.STORM, 2),
        )
        with self.assertRaises(ValueError):
            SimulationConfig(days=1, events=duplicate_events).validate()

    def test_config_rejects_event_target_that_does_not_exist(self) -> None:
        event = ScheduledEvent("bad-failure", EventKind.GENERATOR_FAILURE, 1, target="missing")
        with self.assertRaisesRegex(ValueError, "unknown generator"):
            SimulationConfig(days=1, events=(event,)).validate()

    def test_config_rejects_fractional_hour_values_and_naive_timestamps(self) -> None:
        fractional_failure = ScheduledEvent(
            "fractional", EventKind.GENERATOR_FAILURE, 1,
            duration_hours=1.5, target="gen-1",
        )
        with self.assertRaisesRegex(ValueError, "whole number of hours"):
            SimulationConfig(days=1, events=(fractional_failure,)).validate()
        fractional_mission = MissionConfig("m", "Mission", 2, 1.5, 2)
        with self.assertRaisesRegex(ValueError, "whole number of hours"):
            SimulationConfig(days=1, station=StationConfig(missions=(fractional_mission,))).validate()
        fractional_delay = ScheduledEvent("delay", EventKind.RESUPPLY_DELAY, 1, value=1.5)
        with self.assertRaisesRegex(ValueError, "whole number of hours"):
            SimulationConfig(days=1, events=(fractional_delay,)).validate()
        with self.assertRaisesRegex(ValueError, "UTC offset"):
            SimulationConfig(days=1, start_time="2032-01-01T00:00:00").validate()

    def test_config_rejects_non_finite_numeric_values(self) -> None:
        with self.assertRaisesRegex(ValueError, "finite number"):
            SimulationConfig(station=replace(StationConfig(), solar_capacity_kw=float("nan"))).validate()

    def test_cli_writes_complete_json_result(self) -> None:
        with TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "storm.json"
            with redirect_stdout(StringIO()):
                exit_code = cli_main([
                    "--scenario", "storm", "--days", "3", "--seed", "5",
                    "--output", str(output),
                ])
            data = loads(output.read_text(encoding="utf-8"))
        self.assertEqual(exit_code, 0)
        self.assertEqual(len(data["telemetry"]), 72)
        self.assertEqual(data["summary"]["duration_hours"], 72)
        self.assertTrue(any(item["kind"] == "storm" for item in data["event_log"]))


if __name__ == "__main__":
    unittest.main()
