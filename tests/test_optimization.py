from __future__ import annotations

import unittest
from dataclasses import replace
from importlib.util import find_spec

from backend.optimization import benchmark_solver_candidates, compare_planning_baselines, optimize_schedule
from backend.simulation import EventKind, GeneratorConfig, ResupplyConfig, ScheduledEvent, SimulationEngine
from backend.simulation.forecast_scenarios import build_trajectory
from backend.simulation.scenarios import build_scenario


@unittest.skipUnless(
    find_spec("pyomo") and find_spec("highspy"),
    "Install the optional project optimization extra to run MILP solver tests",
)
class MissionEnergyPlannerTests(unittest.TestCase):
    def test_milp_returns_feasible_schedule_and_simulator_replay(self) -> None:
        config = build_scenario("normal", days=7, seed=42)
        result = optimize_schedule(config, flexibility_hours=6)
        self.assertEqual(result["status"], "optimal")
        self.assertEqual(result["solver"], "HiGHS")
        self.assertEqual(result["objective"]["priority_weighted_missions"], 12.0)
        self.assertTrue(all(item["selected"] for item in result["schedule"]))
        self.assertEqual(result["simulator_replay"]["summary"]["unserved_energy_kwh"], 0.0)
        self.assertEqual(result["simulator_replay"]["summary"]["critical_violation_hours"], 0)
        self.assertEqual(len(result["dispatch"]), config.hours)
        for row in result["dispatch"]:
            self.assertAlmostEqual(
                row["demand_kw"], row["baseline_demand_kw"] + row["mission_demand_kw"],
                places=3,
            )
            supply = (
                row["renewable_used_kw"] + sum(row["generator_output_kw"].values())
                + row["battery_discharge_kw"]
            )
            self.assertAlmostEqual(
                supply, row["demand_kw"] + row["battery_charge_kw"] + row["curtailed_kw"],
                places=3,
            )
        self.assertEqual(
            result["planning_rules"]["terminal_soc_target_kwh"],
            config.station.battery.initial_kwh,
        )

    def test_weather_ineligible_mission_is_excluded_with_reason(self) -> None:
        config = build_scenario("normal", days=7, seed=42)
        options = {mission.id: [mission.start_hour] for mission in config.station.missions}
        weather = build_trajectory("storm", config.hours).weather
        result = optimize_schedule(
            config, start_options=options, weather_forcing=weather
        )
        survey = next(item for item in result["schedule"] if item["mission_id"] == "field-survey")
        self.assertFalse(survey["selected"])
        self.assertIn("weather limits", survey["reason"])

    def test_resource_infeasibility_is_reported_without_a_false_plan(self) -> None:
        config = build_scenario("normal", days=2, seed=7)
        station = replace(
            config.station,
            solar_capacity_kw=0,
            wind_capacity_kw=0,
            generators=(),
            fuel_resupply=None,
            battery=replace(config.station.battery, max_discharge_kw=1),
        )
        config = replace(config, station=station)
        result = optimize_schedule(config, flexibility_hours=0)
        self.assertEqual(result["status"], "infeasible")
        self.assertIn("energy balance", result["reason"])

    def test_resupply_delay_shifts_delivery_and_is_reported(self) -> None:
        config = build_scenario("normal", days=3, seed=4)
        station = replace(
            config.station,
            initial_fuel_liters=1000,
            fuel_capacity_liters=2000,
            fuel_resupply=ResupplyConfig(arrival_hour=24, fuel_liters=500),
        )
        delayed = replace(
            config,
            station=station,
            events=(ScheduledEvent("weather-delay", EventKind.RESUPPLY_DELAY, 12, value=24),),
        )
        result = optimize_schedule(delayed, flexibility_hours=0)
        resupply = result["planning_rules"]["resupply"]
        self.assertEqual(resupply["scheduled_arrival_hour"], 24)
        self.assertEqual(resupply["effective_arrival_hour"], 48)
        self.assertEqual(resupply["delay_event_ids_applied"], ["weather-delay"])
        self.assertEqual(result["dispatch"][24]["resupply_received_liters"], 0)
        self.assertEqual(result["dispatch"][48]["resupply_received_liters"], 500)

    def test_generator_commitment_ramps_minimum_times_and_start_fuel_are_enforced(self) -> None:
        config = build_scenario("normal", days=3, seed=17)
        generator = GeneratorConfig(
            "test-gen", "Test Generator", 100, 18, 0.28,
            ramp_up_kw_per_hour=25,
            ramp_down_kw_per_hour=30,
            min_up_hours=3,
            min_down_hours=2,
            start_fuel_liters=5,
            initial_state_hours=24,
        )
        station = replace(
            config.station,
            solar_capacity_kw=0,
            wind_capacity_kw=0,
            generators=(generator,),
            battery=replace(config.station.battery, initial_kwh=180, reserve_kwh=90),
            fuel_resupply=None,
        )
        result = optimize_schedule(
            replace(config, station=station), flexibility_hours=0, terminal_soc_kwh=150
        )
        self.assertIn(result["status"], {"optimal", "feasible"})
        dispatch = result["dispatch"]
        starts = [hour for hour, row in enumerate(dispatch) if row["generator_started"]["test-gen"]]
        self.assertTrue(starts)
        for hour in starts:
            self.assertEqual(dispatch[hour]["generator_start_fuel_liters"], 5)
            self.assertLessEqual(dispatch[hour]["generator_output_kw"]["test-gen"], 25)
            for active_hour in range(hour, min(hour + generator.min_up_hours, len(dispatch))):
                self.assertTrue(dispatch[active_hour]["generator_on"]["test-gen"])
        stops = [
            hour for hour in range(1, len(dispatch))
            if dispatch[hour - 1]["generator_on"]["test-gen"]
            and not dispatch[hour]["generator_on"]["test-gen"]
        ]
        for hour in stops:
            for off_hour in range(hour, min(hour + generator.min_down_hours, len(dispatch))):
                self.assertFalse(dispatch[off_hour]["generator_on"]["test-gen"])
        for hour in range(1, len(dispatch)):
            if dispatch[hour - 1]["generator_on"]["test-gen"] and dispatch[hour]["generator_on"]["test-gen"]:
                delta = abs(
                    dispatch[hour]["generator_output_kw"]["test-gen"]
                    - dispatch[hour - 1]["generator_output_kw"]["test-gen"]
                )
                self.assertLessEqual(delta, max(generator.ramp_up_kw_per_hour, generator.ramp_down_kw_per_hour))
        self.assertGreaterEqual(dispatch[-1]["battery_soc_kwh"], 150)
        self.assertEqual(result["planning_rules"]["terminal_soc_policy"], "caller_supplied")

    def test_robust_weather_scenarios_use_conservative_envelope(self) -> None:
        config = build_scenario("normal", days=3, seed=23)
        scenarios = {
            name: build_trajectory(name, config.hours).weather
            for name in ("nominal", "low_renewable")
        }
        source_rows = {
            name: SimulationEngine().run(config, weather_forcing=forcing).telemetry
            for name, forcing in scenarios.items()
        }
        result = optimize_schedule(config, flexibility_hours=2, weather_scenarios=scenarios)
        assessment = result["uncertainty_assessment"]
        self.assertEqual(assessment["mode"], "deterministic_worst_case_envelope")
        self.assertEqual(assessment["scenario_names"], ["low_renewable", "nominal"])
        self.assertFalse(assessment["probabilistic"])
        for hour, proposed in enumerate(result["dispatch"]):
            conservative_renewable = min(rows[hour]["renewable_kw"] for rows in source_rows.values())
            self.assertLessEqual(proposed["renewable_available_kw"], conservative_renewable + 1e-4)
        missions = {mission.id: mission for mission in config.station.missions}
        for scheduled in result["schedule"]:
            if not scheduled["selected"]:
                continue
            mission = missions[scheduled["mission_id"]]
            for forcing in scenarios.values():
                for weather in forcing[
                    scheduled["start_hour"]:
                    scheduled["start_hour"] + scheduled["duration_hours"]
                ]:
                    self.assertGreaterEqual(weather.visibility_km, mission.minimum_visibility_km)
                    self.assertLessEqual(weather.wind_kmh, mission.maximum_wind_kmh)
        with self.assertRaisesRegex(ValueError, "at least two"):
            optimize_schedule(config, weather_scenarios={"only": scenarios["nominal"]})

    def test_deadline_and_precedence_are_enforced(self) -> None:
        config = build_scenario("normal", days=7, seed=42)
        result = optimize_schedule(
            config,
            flexibility_hours=12,
            latest_finish_hours={"ice-core": 10},
            precedence=(("water-production", "field-survey"),),
        )
        selected = {item["mission_id"]: item for item in result["schedule"] if item["selected"]}
        ice = selected["ice-core"]
        self.assertLessEqual(ice["start_hour"] + ice["duration_hours"], 10)
        predecessor = selected["water-production"]
        successor = selected["field-survey"]
        self.assertGreaterEqual(successor["start_hour"], predecessor["start_hour"] + predecessor["duration_hours"])
        self.assertEqual(result["planning_rules"]["precedence"], [["water-production", "field-survey"]])

    def test_infeasibility_includes_targeted_power_diagnostics(self) -> None:
        config = build_scenario("normal", days=2, seed=7)
        station = replace(
            config.station, solar_capacity_kw=0, wind_capacity_kw=0, generators=(), fuel_resupply=None,
            battery=replace(config.station.battery, max_discharge_kw=1),
        )
        result = optimize_schedule(replace(config, station=station), flexibility_hours=0)
        self.assertEqual(result["status"], "infeasible")
        self.assertTrue(result["diagnostics"]["likely_power_bottlenecks"])
        self.assertIn("not a solver IIS", result["diagnostics"]["note"])

    def test_matched_baseline_comparison_returns_all_three_plans(self) -> None:
        config = build_scenario("normal", days=3, seed=13)
        result = compare_planning_baselines(config, flexibility_hours=4)
        self.assertEqual(result["seed"], config.seed)
        self.assertTrue(result["same_initial_state_and_weather_seed"])
        self.assertEqual(
            {"schedule_first", "energy_first", "joint_firn"} & result.keys(),
            {"schedule_first", "energy_first", "joint_firn"},
        )
        self.assertIn("unserved_energy_kwh", result["joint_firn"])

    def test_solver_microbenchmark_objectives_match(self) -> None:
        report = benchmark_solver_candidates(sizes=(4, 8), seed=17)
        self.assertTrue(all(case["objectives_match"] for case in report["cases"]))
        self.assertTrue(all(case["highs"]["solve_seconds"] >= 0 for case in report["cases"]))


if __name__ == "__main__":
    unittest.main()
