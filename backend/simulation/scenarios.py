"""Named reproducible operating scenarios used by the CLI and test suite."""

from __future__ import annotations

from dataclasses import replace

from .models import (
    EventKind,
    GeneratorConfig,
    MissionConfig,
    MissionPriority,
    ScheduledEvent,
    SimulationConfig,
    StationConfig,
)


def build_scenario(name: str, days: int = 30, seed: int = 42) -> SimulationConfig:
    """Return a synthetic, explicitly configured station scenario."""
    base_missions = (
        MissionConfig(
            id="ice-core",
            name="Ice Core Analysis",
            power_kw=8,
            duration_hours=4,
            start_hour=9,
            priority=MissionPriority.HIGH,
            equipment=("spectrometer",),
            personnel=("scientist-01",),
            minimum_visibility_km=1.0,
        ),
        MissionConfig(
            id="water-production",
            name="Water Production Run",
            power_kw=12,
            duration_hours=2,
            start_hour=16,
            priority=MissionPriority.CRITICAL,
            equipment=("desalination-unit",),
            personnel=("operator-01",),
        ),
        MissionConfig(
            id="field-survey",
            name="Coastal Field Survey",
            power_kw=6,
            duration_hours=3,
            start_hour=24 + 8,
            priority=MissionPriority.MEDIUM,
            equipment=("tracked-vehicle", "field-kit"),
            personnel=("scientist-02", "guide-01"),
            minimum_visibility_km=2.0,
            maximum_wind_kmh=55,
            non_electric_fuel_l=18,
        ),
        MissionConfig(
            id="sample-processing",
            name="Sample Processing",
            power_kw=5,
            duration_hours=2,
            start_hour=24 + 14,
            priority=MissionPriority.HIGH,
            equipment=("lab-instruments",),
            personnel=("scientist-01",),
        ),
    )
    station = StationConfig(
        missions=base_missions,
        generators=(
            GeneratorConfig(
                "gen-1", "Generator 01", 100.0, 18.0,
                ramp_up_kw_per_hour=60.0,
                ramp_down_kw_per_hour=60.0,
                min_up_hours=3,
                min_down_hours=2,
                start_fuel_liters=3.0,
                initial_state_hours=24,
            ),
            GeneratorConfig(
                "gen-2", "Generator 02", 80.0, 15.0,
                ramp_up_kw_per_hour=50.0,
                ramp_down_kw_per_hour=50.0,
                min_up_hours=3,
                min_down_hours=2,
                start_fuel_liters=2.5,
                initial_state_hours=24,
            ),
        ),
    )
    if station.fuel_resupply and station.fuel_resupply.arrival_hour >= days * 24:
        station = replace(
            station,
            fuel_resupply=replace(station.fuel_resupply, arrival_hour=days * 24 - 1),
        )
    events: tuple[ScheduledEvent, ...] = ()

    if name == "normal":
        pass
    elif name == "storm":
        event_hour = min(24 * 4, days * 24 - 8)
        events = (
            ScheduledEvent(
                id="storm-front",
                kind=EventKind.STORM,
                hour=event_hour,
                duration_hours=min(48, days * 24 - event_hour),
            ),
        )
        survey_hour = min(event_hour + 2, days * 24 - 3)
        station = replace(
            station,
            missions=base_missions
            + (
                MissionConfig(
                    id="storm-field-survey",
                    name="Storm-window Field Survey",
                    power_kw=6,
                    duration_hours=3,
                    start_hour=survey_hour,
                    priority=MissionPriority.MEDIUM,
                    equipment=("tracked-vehicle",),
                    personnel=("guide-01",),
                    minimum_visibility_km=2.0,
                    maximum_wind_kmh=55,
                ),
            ),
        )
    elif name == "generator_failure":
        event_hour = min(24 * 7, days * 24 - 4)
        events = (
            ScheduledEvent(
                id="gen-1-bearing-failure",
                kind=EventKind.GENERATOR_FAILURE,
                hour=event_hour,
                duration_hours=min(24, days * 24 - event_hour),
                target="gen-1",
            ),
        )
    elif name == "resupply_delay":
        delay_hour = min(24 * 10, max(0, station.fuel_resupply.arrival_hour - 48))
        events = (
            ScheduledEvent(
                id="resupply-weather-delay",
                kind=EventKind.RESUPPLY_DELAY,
                hour=delay_hour,
                value=24 * 5,
            ),
        )
        station = replace(
            station,
            fuel_resupply=replace(
                station.fuel_resupply,
                arrival_hour=min(24 * 12, days * 24 - 1),
            ),
        )
    elif name == "low_renewable":
        station = replace(station, solar_capacity_kw=2.0, wind_capacity_kw=2.0)
    elif name == "mission_energy":
        station = replace(
            station,
            missions=(
                MissionConfig(
                    id="high-power-experiment",
                    name="High Power Experiment",
                    power_kw=80,
                    duration_hours=4,
                    start_hour=min(10, days * 24 - 4),
                    priority=MissionPriority.HIGH,
                    equipment=("power-module",),
                    personnel=("scientist-01",),
                ),
            ),
        )
    elif name == "battery_capacity_loss":
        battery = station.battery
        station = replace(
            station,
            battery=replace(
                battery,
                capacity_kwh=round(battery.capacity_kwh * 0.7, 3),
                initial_kwh=round(battery.initial_kwh * 0.7, 3),
                reserve_kwh=round(battery.reserve_kwh * 0.7, 3),
            ),
        )
    else:
        raise ValueError(
            "Unknown scenario. Choose normal, storm, generator_failure, "
            "resupply_delay, low_renewable, mission_energy, or battery_capacity_loss."
        )

    return SimulationConfig(days=days, seed=seed, station=station, events=events)


SCENARIO_NAMES = (
    "normal",
    "storm",
    "generator_failure",
    "resupply_delay",
    "low_renewable",
    "mission_energy",
    "battery_capacity_loss",
)
