"""Reconstruct saved inputs, never substitute today's scenario defaults."""
from __future__ import annotations

from dataclasses import asdict
import hashlib
import json
from typing import Any

from backend.simulation import (
    BatteryConfig, EventKind, GeneratorConfig, LoadConfig, MissionConfig,
    MissionPriority, ResupplyConfig, ScheduledEvent, SimulationConfig, StationConfig,
)


def restore_config(snapshot: dict[str, Any]) -> SimulationConfig:
    try:
        station = dict(snapshot["station"])
        station["battery"] = BatteryConfig(**station["battery"])
        station["loads"] = LoadConfig(**station["loads"])
        station["generators"] = tuple(GeneratorConfig(**item) for item in station["generators"])
        station["missions"] = tuple(
            MissionConfig(**{**item, "priority": MissionPriority(item["priority"]),
                            "equipment": tuple(item.get("equipment", ())),
                            "personnel": tuple(item.get("personnel", ()))})
            for item in station["missions"]
        )
        station["fuel_resupply"] = (
            ResupplyConfig(**station["fuel_resupply"]) if station["fuel_resupply"] else None
        )
        config = SimulationConfig(
            days=snapshot["days"], seed=snapshot["seed"], start_time=snapshot["start_time"],
            station=StationConfig(**station),
            horizon_hours=snapshot.get("horizon_hours"),
            events=tuple(ScheduledEvent(**{**item, "kind": EventKind(item["kind"])})
                         for item in snapshot["events"]),
        )
        config.validate()
        return config
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"Saved case configuration cannot be reconstructed: {exc}") from exc


def fingerprint(config: SimulationConfig) -> str:
    return hashlib.sha256(json.dumps(asdict(config), sort_keys=True).encode()).hexdigest()
