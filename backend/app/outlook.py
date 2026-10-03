"""Expose existing forecasting and scenario engines with explicit provenance."""
from dataclasses import asdict
from typing import Any

from backend.app.case_config import fingerprint, restore_config
from backend.app.models import SimulationRun
from backend.simulation import SimulationEngine
from backend.simulation.forecast_scenarios import build_trajectory
from backend.simulation.forecasting import forecast


def case_outlook(run: SimulationRun, telemetry: list[dict[str, Any]], origin: int, horizon: int) -> dict[str, Any]:
    config = restore_config(run.config_snapshot)
    if config.days > 30:
        raise ValueError("Look-ahead comparisons are limited to 30-day cases")
    if not 0 <= origin < config.hours:
        raise ValueError("Forecast origin must lie within the saved case")
    training = sorted((p for p in telemetry if p["hour"] <= origin), key=lambda p: p["hour"])
    if [p["hour"] for p in training] != list(range(origin + 1)):
        raise ValueError("Forecast training requires contiguous saved observations through the origin")
    method = "seasonal_naive" if len(training) >= 24 else "persistence"
    series = {key: forecast([p[key] for p in training], horizon, method=method)
              for key in ("demand_kw", "renewable_kw")}
    cases = []
    for name in ("nominal", "low_renewable", "storm"):
        trajectory = build_trajectory(name, config.hours)
        result = SimulationEngine().run(config, weather_forcing=trajectory.weather)
        cases.append({"name": name, "description": trajectory.description,
                      "summary": result.summary, "telemetry": result.telemetry,
                      "mission_results": result.mission_results})
    return {
        "source_run_id": str(run.id), "config_fingerprint": fingerprint(config),
        "origin_hour": origin, "horizon_hours": horizon,
        "forecast": {"method": method, "training_hours": len(training),
                     "points": [{"hour": origin + i + 1, **{k: values[i] for k, values in series.items()}}
                                for i in range(horizon)]},
        "cases": cases,
        "assumptions": {
            "comparison_basis": "Matched-start alternative cases over the full saved horizon; not forecasts conditioned on the current resource state.",
            "probabilistic": False, "station_config": "saved run snapshot",
            "events": "Saved disruptions and resupply retained in every case.",
            "forecast_basis": "Numeric baseline uses only saved hourly observations at or before the selected origin; no future samples.",
            "scenario_model": "six-hour weather blocks; storm window from existing synthetic trajectory engine",
            "config": asdict(config),
        },
    }
