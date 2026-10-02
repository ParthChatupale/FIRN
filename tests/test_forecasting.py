from __future__ import annotations

import unittest

from backend.simulation.forecasting import evaluate_rolling_origin, forecast


class ForecastBaselineTests(unittest.TestCase):
    def test_persistence_forecast_repeats_last_available_value(self) -> None:
        self.assertEqual(forecast([2.0, 4.0, 7.0], 3), [7.0, 7.0, 7.0])

    def test_seasonal_naive_repeats_last_complete_season(self) -> None:
        self.assertEqual(
            forecast([1, 2, 3, 4, 5, 6], 5, method="seasonal_naive", season_hours=3),
            [4.0, 5.0, 6.0, 4.0, 5.0],
        )

    def test_rolling_evaluation_scores_only_after_each_origin(self) -> None:
        result = evaluate_rolling_origin(
            [1, 2, 3, 4, 5], horizon_hours=1, min_training_hours=2
        )
        self.assertEqual(result["origins"], 3)
        self.assertEqual(result["count"], 3)
        self.assertAlmostEqual(result["mae"], 1.0)
        self.assertAlmostEqual(result["mean_error"], -1.0)

    def test_seasonal_naive_evaluation_respects_daily_history(self) -> None:
        values = [float(hour % 24) for hour in range(72)]
        result = evaluate_rolling_origin(
            values, horizon_hours=3, method="seasonal_naive", season_hours=24,
            min_training_hours=48, stride_hours=3,
        )
        self.assertEqual(result["method"], "seasonal_naive")
        self.assertEqual(result["mae"], 0.0)
        self.assertEqual(result["origins"], 8)

    def test_rejects_invalid_values_and_unavailable_history(self) -> None:
        with self.assertRaises(ValueError):
            forecast([1.0, float("nan")], 2)
        with self.assertRaises(ValueError):
            forecast([1, 2], 1, method="seasonal_naive", season_hours=24)
        with self.assertRaises(ValueError):
            evaluate_rolling_origin([1, 2, 3], horizon_hours=3)


if __name__ == "__main__":
    unittest.main()
