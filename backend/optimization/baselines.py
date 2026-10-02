"""Transparent matched baselines for evaluating joint mission/energy plans."""

from __future__ import annotations

from dataclasses import replace
from time import perf_counter
from typing import Any

from backend.simulation import MissionConfig, SimulationConfig, SimulationEngine, WeatherForcing

from .planner import optimize_schedule


def _metrics(result: Any, missions: tuple[MissionConfig, ...], elapsed: float) -> dict[str, Any]:
    summary = result.summary
    return {
        "mission_ids": [mission.id for mission in missions],
        "mission_success_count": sum(item.get("status") == "completed" for item in result.mission_results),
        "mission_results": result.mission_results,
        "fuel_used_liters": summary.get("total_fuel_consumed_liters"),
        "unserved_energy_kwh": summary.get("unserved_energy_kwh"),
        "critical_violation_hours": summary.get("critical_violation_hours"),
        "runtime_seconds": round(elapsed, 6),
        "summary": summary,
    }


def _energy_first_schedule(
    config: SimulationConfig,
    forcing: tuple[WeatherForcing, ...] | None,
    flexibility_hours: int,
) -> tuple[MissionConfig, ...]:
    engine = SimulationEngine()
    station_only = engine.run(replace(config, station=replace(config.station, missions=())), weather_forcing=forcing)
    rows = station_only.telemetry
    used: dict[str, set[int]] = {}
    chosen: list[MissionConfig] = []
    priority_order = sorted(config.station.missions, key=lambda m: (int(m.priority), m.start_hour, m.id))
    for mission in priority_order:
        earliest = max(0, mission.start_hour - flexibility_hours)
        latest = min(config.hours - mission.duration_hours, mission.start_hour + flexibility_hours)
        candidates = []
        for start in range(earliest, latest + 1):
            active_hours = range(start, start + mission.duration_hours)
            if any(
                rows[h]["visibility_km"] < mission.minimum_visibility_km
                or rows[h]["wind_kmh"] > mission.maximum_wind_kmh
                for h in active_hours
            ):
                continue
            resources = set((*mission.equipment, *mission.personnel))
            if any(used.get(resource, set()).intersection(active_hours) for resource in resources):
                continue
            stress = 0.0
            for h in active_hours:
                row = rows[h]
                gen_capacity = sum(g.capacity_kw for g in config.station.generators)
                gen_load = sum(row.get("generator_output_kw", {}).values())
                battery_fraction = row.get("battery_discharge_kw", 0.0) / max(config.station.battery.max_discharge_kw, 1e-9)
                stress += gen_load / max(gen_capacity, 1e-9) + battery_fraction * 0.5
            candidates.append((stress, start))
        if not candidates:
            continue
        _stress, start = min(candidates)
        chosen.append(replace(mission, start_hour=start))
        for resource in set((*mission.equipment, *mission.personnel)):
            used.setdefault(resource, set()).update(range(start, start + mission.duration_hours))
    return tuple(chosen)


def compare_planning_baselines(
    config: SimulationConfig,
    *,
    flexibility_hours: int = 12,
    weather_forcing: tuple[WeatherForcing, ...] | None = None,
) -> dict[str, Any]:
    """Compare Schedule-first, Energy-first, and Joint FIRN with the same inputs.

    Schedule-first preserves operator-specified starts. Energy-first runs station
    dispatch with missions removed, then greedily packs higher-priority missions
    into lower-stress feasible windows. Joint FIRN uses the MILP. These are
    explicit heuristic baselines, not claims about optimal human practice.
    """
    if weather_forcing is not None and len(weather_forcing) != config.hours:
        raise ValueError("Weather forcing must contain exactly one item per simulation hour")
    engine = SimulationEngine()
    output: dict[str, Any] = {
        "station": config.station.name,
        "seed": config.seed,
        "duration_hours": config.hours,
        "same_initial_state_and_weather_seed": True,
        "baseline_definitions": {
            "schedule_first": "Replay configured mission starts without joint energy optimization.",
            "energy_first": "Simulate station-only dispatch, then greedily place higher-priority missions in the least-stressed weather/resource-feasible candidate windows.",
            "joint_firn": "Pyomo/HiGHS lexicographic MILP, followed by independent simulator replay.",
        },
    }
    for name in ("schedule_first", "energy_first"):
        started = perf_counter()
        missions = (
            config.station.missions
            if name == "schedule_first"
            else _energy_first_schedule(config, weather_forcing, flexibility_hours)
        )
        run_config = replace(config, station=replace(config.station, missions=missions))
        result = engine.run(run_config, weather_forcing=weather_forcing)
        output[name] = _metrics(result, missions, perf_counter() - started)

    started = perf_counter()
    joint = optimize_schedule(config, flexibility_hours=flexibility_hours, weather_forcing=weather_forcing)
    selected = tuple(
        replace(mission, start_hour=item["start_hour"])
        for mission in config.station.missions
        for item in joint.get("schedule", [])
        if item["mission_id"] == mission.id and item["selected"]
    )
    output["joint_firn"] = {
        **_metrics_from_replay(joint, selected, perf_counter() - started),
        "optimizer_status": joint["status"],
        "objective": joint.get("objective"),
    }
    output["interpretation"] = "Compare outcomes descriptively; this matched synthetic run does not establish general optimizer superiority."
    return output


def _metrics_from_replay(plan: dict[str, Any], missions: tuple[MissionConfig, ...], elapsed: float) -> dict[str, Any]:
    replay = plan.get("simulator_replay", {})
    summary = replay.get("summary", {})
    results = replay.get("mission_results", [])
    return {
        "mission_ids": [mission.id for mission in missions],
        "mission_success_count": sum(item.get("status") == "completed" for item in results),
        "mission_results": results,
        "fuel_used_liters": summary.get("total_fuel_consumed_liters"),
        "unserved_energy_kwh": summary.get("unserved_energy_kwh"),
        "critical_violation_hours": summary.get("critical_violation_hours"),
        "runtime_seconds": round(elapsed, 6),
        "summary": summary,
    }
