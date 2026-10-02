from __future__ import annotations

import unittest

from backend.simulation.forecast_evaluation import evaluate_synthetic_seed_set


class SyntheticForecastEvaluationTests(unittest.TestCase):
    def test_multi_seed_summary_is_repeatable_and_contains_seed_level_scores(self) -> None:
        first = evaluate_synthetic_seed_set((7, 11), days=2, horizon_hours=24)
        second = evaluate_synthetic_seed_set((7, 11), days=2, horizon_hours=24)
        self.assertEqual(first, second)
        self.assertIn("synthetic", first["data_classification"])
        self.assertEqual(first["training_hours_per_seed"], 24)
        self.assertEqual(first["origins_per_seed_target_method"], 1)
        self.assertEqual(len(first["aggregate"]), 12)
        self.assertEqual(len(first["per_seed"]), 24)
        self.assertTrue(all(row["forecast_count"] == 24 for row in first["per_seed"]))

    def test_rejects_empty_duplicate_and_insufficient_seed_evaluation(self) -> None:
        with self.assertRaisesRegex(ValueError, "At least one"):
            evaluate_synthetic_seed_set((), days=2, horizon_hours=24)
        with self.assertRaisesRegex(ValueError, "unique"):
            evaluate_synthetic_seed_set((1, 1), days=2, horizon_hours=24)
        with self.assertRaisesRegex(ValueError, "training hours"):
            evaluate_synthetic_seed_set((1,), days=2, horizon_hours=25)


if __name__ == "__main__":
    unittest.main()
