"""Interpretable synthetic weather trajectories for forecast what-if runs."""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Literal

from .engine import SimulationEngine
from .models import SimulationResult, WeatherForcing
from .scenarios import build_scenario


TrajectoryName = Literal["favorable", "nominal", "low_renewable", "storm"]


@dataclass(frozen=True)
class SyntheticForecastTrajectory:
    name: TrajectoryName
    description: str
    weather: tuple[WeatherForcing, ...]
    data_classification: str = "synthetic scenario; not a forecast or calibrated probability"


@dataclass(frozen=True)
class TrajectoryComparison:
    name: TrajectoryName
    description: str
    data_classification: str
    seed: int
    duration_days: int
    summary: dict[str, float | int | bool | None]
    mission_results: list[dict[str, object]]


_PROFILE_BLOCKS: dict[str, tuple[WeatherForcing, ...]] = {
    "favorable": (
        WeatherForcing("clear", -21.0, 43.0, 7.0, 0.96, 0.90),
        WeatherForcing("clear", -20.0, 47.0, 8.0, 0.92, 0.94),
        WeatherForcing("cloudy", -22.0, 39.0, 6.0, 0.68, 0.82),
        WeatherForcing("clear", -21.0, 44.0, 7.5, 0.96, 0.90),
    ),
    "nominal": (
        WeatherForcing("clear", -25.0, 32.0, 5.5, 0.78, 0.64),
        WeatherForcing("cloudy", -24.0, 37.0, 4.0, 0.38, 0.74),
        WeatherForcing("cloudy", -23.0, 35.0, 4.5, 0.43, 0.70),
        WeatherForcing("clear", -25.0, 31.0, 5.5, 0.76, 0.62),
    ),
    "low_renewable": (
        WeatherForcing("cloudy", -29.0, 19.0, 3.2, 0.16, 0.34),
        WeatherForcing("cloudy", -28.0, 22.0, 3.0, 0.19, 0.38),
        WeatherForcing("cloudy", -30.0, 17.0, 2.8, 0.12, 0.30),
        WeatherForcing("cloudy", -28.0, 23.0, 3.4, 0.20, 0.40),
    ),
}

_DESCRIPTIONS: dict[TrajectoryName, str] = {
    "favorable": "Mostly clear conditions with productive winds below the turbine cut-out threshold.",
    "nominal": "Alternating clear and cloudy six-hour blocks with moderate wind.",
    "low_renewable": "Persistent cloud and weak winds reduce solar and wind availability.",
    "storm": "Nominal background conditions with a 36-hour storm window beginning at hour 24.",
}


def build_trajectory(name: TrajectoryName, hours: int) -> SyntheticForecastTrajectory:
    """Build a deterministic, hourly synthetic weather forcing trajectory."""
    if isinstance(hours, bool) or not isinstance(hours, int) or hours < 1:
        raise ValueError("Trajectory duration must be a positive whole number of hours")
    if name not in (*_PROFILE_BLOCKS, "storm"):
        raise ValueError(f"Unknown forecast trajectory: {name}")

    blocks = _PROFILE_BLOCKS["nominal"] if name == "storm" else _PROFILE_BLOCKS[name]
    weather = [blocks[(hour // 6) % len(blocks)] for hour in range(hours)]
    if name == "storm":
        storm_start = min(24, max(0, hours // 4))
        storm_end = min(hours, storm_start + 36)
        storm = WeatherForcing("storm", -31.0, 100.0, 0.7, 0.08, 0.0)
        weather[storm_start:storm_end] = [storm] * (storm_end - storm_start)
    return SyntheticForecastTrajectory(
        name=name,
        description=_DESCRIPTIONS[name],
        weather=tuple(weather),
    )


def compare_synthetic_trajectories(
    *, days: int = 7, seed: int = 42
) -> list[TrajectoryComparison]:
    """Run all four trajectories against the same station config, missions, and seed."""
    base_config = build_scenario("normal", days=days, seed=seed)
    # Avoid the scenario builder's short-run convention of moving resupply to
    # the final hour; otherwise ending fuel inventory includes a last-hour drop.
    config = replace(
        base_config,
        station=replace(base_config.station, fuel_resupply=None),
    )
    engine = SimulationEngine()
    comparisons: list[TrajectoryComparison] = []
    for name in ("favorable", "nominal", "low_renewable", "storm"):
        trajectory = build_trajectory(name, config.hours)
        result: SimulationResult = engine.run(config, weather_forcing=trajectory.weather)
        summary = result.summary
        comparisons.append(
            TrajectoryComparison(
                name=name,
                description=trajectory.description,
                data_classification=trajectory.data_classification,
                seed=seed,
                duration_days=days,
                summary={
                    "renewable_energy_kwh": summary["renewable_energy_kwh"],
                    "generator_energy_kwh": summary["generator_energy_kwh"],
                    "total_fuel_consumed_liters": summary["total_fuel_consumed_liters"],
                    "fuel_remaining_liters": summary["fuel_remaining_liters"],
                    "unserved_energy_kwh": summary["unserved_energy_kwh"],
                    "critical_violation_hours": summary["critical_violation_hours"],
                    "battery_min_kwh": summary["battery_min_kwh"],
                    "missions_completed": summary["missions_completed"],
                    "missions_deferred": summary["missions_deferred"],
                    "missions_failed": summary["missions_failed"],
                },
                mission_results=result.mission_results,
            )
        )
    return comparisons
