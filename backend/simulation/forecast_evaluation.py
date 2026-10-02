"""Repeatable multi-seed evaluation of forecast baselines on synthetic runs."""

from __future__ import annotations

from collections.abc import Sequence
from statistics import mean, median
from typing import Any

from .engine import SimulationEngine
from .forecasting import ForecastMethod, evaluate_rolling_origin
from .scenarios import build_scenario


SYNTHETIC_TARGETS: dict[str, str] = {
    "temperature_c": "°C",
    "wind_kmh": "km/h",
    "visibility_km": "km",
    "solar_kw": "kW",
    "renewable_kw": "kW",
    "demand_kw": "kW",
}


def evaluate_synthetic_seed_set(
    seeds: Sequence[int] = tuple(range(20)),
    *,
    days: int = 30,
    horizon_hours: int = 168,
    methods: Sequence[ForecastMethod] = ("persistence", "seasonal_naive"),
) -> dict[str, Any]:
    """Score point baselines on one final holdout per synthetic seeded run.

    Every run uses its first ``days * 24 - horizon_hours`` observations as
    training and its final ``horizon_hours`` as a single held-out origin.
    Aggregates are across simulator seeds, not calibrated forecast intervals.
    """
    if not seeds:
        raise ValueError("At least one simulator seed is required")
    if any(isinstance(seed, bool) or not isinstance(seed, int) for seed in seeds):
        raise ValueError("Simulator seeds must be integers")
    if len(set(seeds)) != len(seeds):
        raise ValueError("Simulator seeds must be unique")
    if isinstance(days, bool) or not isinstance(days, int) or days < 2:
        raise ValueError("Evaluation duration must be at least two whole days")
    total_hours = days * 24
    if (
        isinstance(horizon_hours, bool)
        or not isinstance(horizon_hours, int)
        or horizon_hours < 1
        or total_hours - horizon_hours < 24
    ):
        raise ValueError("Horizon must leave at least 24 training hours in the run")
    if not methods or len(set(methods)) != len(methods):
        raise ValueError("At least one unique forecast method is required")

    training_hours = total_hours - horizon_hours
    engine = SimulationEngine()
    per_seed: list[dict[str, Any]] = []
    grouped: dict[tuple[str, str], list[dict[str, float | int]]] = {}
    for seed in seeds:
        telemetry = engine.run(
            build_scenario("normal", days=days, seed=seed)
        ).telemetry
        for target in SYNTHETIC_TARGETS:
            values = [row[target] for row in telemetry]
            for method in methods:
                scores = evaluate_rolling_origin(
                    values,
                    horizon_hours=horizon_hours,
                    method=method,
                    min_training_hours=training_hours,
                )
                record: dict[str, Any] = {
                    "seed": seed,
                    "target": target,
                    "method": method,
                    "mae": scores["mae"],
                    "rmse": scores["rmse"],
                    "mean_error": scores["mean_error"],
                    "forecast_count": scores["count"],
                    "origins": scores["origins"],
                }
                per_seed.append(record)
                grouped.setdefault((target, method), []).append(record)

    aggregate: list[dict[str, Any]] = []
    for (target, method), records in grouped.items():
        metrics: dict[str, dict[str, float]] = {}
        for metric in ("mae", "rmse", "mean_error"):
            values = [float(record[metric]) for record in records]
            metrics[metric] = {
                "mean": mean(values),
                "median": median(values),
                "min": min(values),
                "max": max(values),
            }
        aggregate.append({
            "target": target,
            "unit": SYNTHETIC_TARGETS[target],
            "method": method,
            "seed_count": len(records),
            "metrics_across_seeds": metrics,
        })

    return {
        "data_classification": "synthetic simulator evaluation; not real-weather validation or calibrated uncertainty",
        "scenario": "normal",
        "days": days,
        "seeds": list(seeds),
        "training_hours_per_seed": training_hours,
        "held_out_horizon_hours": horizon_hours,
        "origins_per_seed_target_method": 1,
        "aggregate": aggregate,
        "per_seed": per_seed,
    }
