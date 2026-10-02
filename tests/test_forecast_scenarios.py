from __future__ import annotations

import unittest

from backend.simulation import SimulationConfig, SimulationEngine, WeatherForcing
from backend.simulation.forecast_scenarios import (
    build_trajectory,
    compare_synthetic_trajectories,
)
from backend.simulation.scenarios import build_scenario


class SyntheticForecastTrajectoryTests(unittest.TestCase):
    def test_builds_hourly_deterministic_profiles_and_labels_them_synthetic(self) -> None:
        first = build_trajectory("storm", 96)
        second = build_trajectory("storm", 96)
        self.assertEqual(first, second)
        self.assertEqual(len(first.weather), 96)
        self.assertIn("synthetic", first.data_classification)
        self.assertEqual(sum(point.regime == "storm" for point in first.weather), 36)

    def test_engine_requires_one_valid_forcing_value_per_hour(self) -> None:
        config = build_scenario("normal", days=2, seed=12)
        engine = SimulationEngine()
        with self.assertRaisesRegex(ValueError, "exactly one item"):
            engine.run(config, weather_forcing=[WeatherForcing("clear", -20, 30, 5, 0.8, 0.7)])
        invalid = WeatherForcing("clear", -20, 30, 5, 1.2, 0.7)
        with self.assertRaisesRegex(ValueError, "between 0 and 1"):
            engine.run(config, weather_forcing=[invalid] * config.hours)

    def test_forcing_drives_telemetry_and_matched_trajectory_outcomes(self) -> None:
        comparisons = compare_synthetic_trajectories(days=7, seed=42)
        by_name = {result.name: result for result in comparisons}
        self.assertEqual(set(by_name), {"favorable", "nominal", "low_renewable", "storm"})
        self.assertTrue(all("synthetic" in item.data_classification for item in comparisons))
        self.assertTrue(all(item.seed == 42 and item.duration_days == 7 for item in comparisons))

        favorable = by_name["favorable"]
        nominal = by_name["nominal"]
        low = by_name["low_renewable"]
        storm = by_name["storm"]
        self.assertGreater(favorable.summary["renewable_energy_kwh"], nominal.summary["renewable_energy_kwh"])
        self.assertGreater(nominal.summary["renewable_energy_kwh"], low.summary["renewable_energy_kwh"])
        self.assertGreater(favorable.summary["fuel_remaining_liters"], low.summary["fuel_remaining_liters"])
        self.assertEqual(favorable.summary["unserved_energy_kwh"], 0.0)
        self.assertEqual(storm.summary["critical_violation_hours"], 0)

        missions = {mission["id"]: mission for mission in storm.mission_results}
        self.assertEqual(missions["field-survey"]["status"], "deferred")
        self.assertEqual(
            {mission["id"]: mission["status"] for mission in favorable.mission_results}
            ["field-survey"],
            "completed",
        )

    def test_default_seeded_weather_path_remains_repeatable(self) -> None:
        config = SimulationConfig(days=2, seed=33)
        engine = SimulationEngine()
        self.assertEqual(engine.run(config).to_dict(), engine.run(config).to_dict())


if __name__ == "__main__":
    unittest.main()
