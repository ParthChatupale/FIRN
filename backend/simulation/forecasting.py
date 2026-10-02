"""Transparent, leakage-safe forecast baselines for hourly numeric series.

These functions do not infer station conditions. They evaluate forecasts against
an explicitly supplied hourly trajectory, which may be synthetic or observed.
"""

from __future__ import annotations

from collections.abc import Sequence
import math
from typing import Literal, TypedDict


ForecastMethod = Literal["persistence", "seasonal_naive"]


class LeadMetrics(TypedDict):
    lead_hour: int
    count: int
    mae: float
    rmse: float
    mean_error: float


class ForecastEvaluation(TypedDict):
    method: ForecastMethod
    horizon_hours: int
    origins: int
    count: int
    mae: float
    rmse: float
    mean_error: float
    by_lead: list[LeadMetrics]


def _validated_series(values: Sequence[float]) -> list[float]:
    if not values:
        raise ValueError("At least one observation is required")
    result: list[float] = []
    for value in values:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("Observations must be finite numbers")
        numeric = float(value)
        if not math.isfinite(numeric):
            raise ValueError("Observations must be finite numbers")
        result.append(numeric)
    return result


def forecast(
    training_values: Sequence[float],
    horizon_hours: int,
    *,
    method: ForecastMethod = "persistence",
    season_hours: int = 24,
) -> list[float]:
    """Forecast future values using only observations available at the origin."""
    values = _validated_series(training_values)
    if isinstance(horizon_hours, bool) or not isinstance(horizon_hours, int) or horizon_hours < 1:
        raise ValueError("Forecast horizon must be a positive whole number of hours")
    if method == "persistence":
        return [values[-1]] * horizon_hours
    if method != "seasonal_naive":
        raise ValueError(f"Unsupported forecast method: {method}")
    if isinstance(season_hours, bool) or not isinstance(season_hours, int) or season_hours < 1:
        raise ValueError("Season length must be a positive whole number of hours")
    if len(values) < season_hours:
        raise ValueError(f"Seasonal naive requires at least {season_hours} observations")
    last_season = values[-season_hours:]
    return [last_season[index % season_hours] for index in range(horizon_hours)]


def evaluate_rolling_origin(
    values: Sequence[float],
    *,
    horizon_hours: int = 24,
    method: ForecastMethod = "persistence",
    season_hours: int = 24,
    min_training_hours: int | None = None,
    stride_hours: int = 1,
) -> ForecastEvaluation:
    """Evaluate rolling forecasts on later observations, never training on them.

    ``origin`` is the number of observations available to the forecaster. Each
    forecast is scored against the immediately following ``horizon_hours``.
    The caller is responsible for supplying a gap-free, hourly series.
    """
    series = _validated_series(values)
    for label, value in (("Forecast horizon", horizon_hours), ("Origin stride", stride_hours)):
        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            raise ValueError(f"{label} must be a positive whole number of hours")
    minimum = min_training_hours
    if minimum is None:
        minimum = season_hours if method == "seasonal_naive" else 1
    if isinstance(minimum, bool) or not isinstance(minimum, int) or minimum < 1:
        raise ValueError("Minimum training period must be a positive whole number of hours")
    if method == "seasonal_naive":
        minimum = max(minimum, season_hours)
    origins = list(range(minimum, len(series) - horizon_hours + 1, stride_hours))
    if not origins:
        raise ValueError("Not enough observations for the requested training period and horizon")

    errors_by_lead: list[list[float]] = [[] for _ in range(horizon_hours)]
    for origin in origins:
        predicted = forecast(
            series[:origin], horizon_hours, method=method, season_hours=season_hours
        )
        for lead, (prediction, actual) in enumerate(
            zip(predicted, series[origin:origin + horizon_hours], strict=True)
        ):
            errors_by_lead[lead].append(prediction - actual)

    def metrics(errors: list[float]) -> tuple[float, float, float]:
        return (
            sum(abs(error) for error in errors) / len(errors),
            math.sqrt(sum(error * error for error in errors) / len(errors)),
            sum(errors) / len(errors),
        )

    all_errors = [error for lead_errors in errors_by_lead for error in lead_errors]
    mae, rmse, mean_error = metrics(all_errors)
    by_lead: list[LeadMetrics] = []
    for lead, errors in enumerate(errors_by_lead, start=1):
        lead_mae, lead_rmse, lead_bias = metrics(errors)
        by_lead.append({
            "lead_hour": lead,
            "count": len(errors),
            "mae": lead_mae,
            "rmse": lead_rmse,
            "mean_error": lead_bias,
        })
    return {
        "method": method,
        "horizon_hours": horizon_hours,
        "origins": len(origins),
        "count": len(all_errors),
        "mae": mae,
        "rmse": rmse,
        "mean_error": mean_error,
        "by_lead": by_lead,
    }
