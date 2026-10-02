"""Validated input and output contracts for FIRN's station simulation."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
from enum import IntEnum, StrEnum
import math
from typing import Any


def _validate_finite(label: str, value: int | float) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be a finite number")
    try:
        finite = math.isfinite(value)
    except OverflowError:
        finite = False
    if not finite:
        raise ValueError(f"{label} must be a finite number")


def _validate_hour(label: str, value: int) -> None:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{label} must be a whole number of hours")


class MissionPriority(IntEnum):
    CRITICAL = 0
    HIGH = 1
    MEDIUM = 2
    LOW = 3


class EventKind(StrEnum):
    GENERATOR_FAILURE = "generator_failure"
    STORM = "storm"
    RESUPPLY_DELAY = "resupply_delay"


@dataclass(frozen=True)
class WeatherForcing:
    """One explicit synthetic or observed weather input for a simulation hour."""

    regime: str
    temperature_c: float
    wind_kmh: float
    visibility_km: float
    solar_factor: float
    wind_factor: float

    def validate(self) -> None:
        if not self.regime.strip():
            raise ValueError("Weather regime is required")
        for label, value in (
            ("Temperature", self.temperature_c),
            ("Wind speed", self.wind_kmh),
            ("Visibility", self.visibility_km),
            ("Solar availability factor", self.solar_factor),
            ("Wind availability factor", self.wind_factor),
        ):
            _validate_finite(label, value)
        if self.wind_kmh < 0 or self.visibility_km < 0:
            raise ValueError("Wind speed and visibility cannot be negative")
        if not 0 <= self.solar_factor <= 1 or not 0 <= self.wind_factor <= 1:
            raise ValueError("Weather generation factors must be between 0 and 1")


@dataclass(frozen=True)
class BatteryConfig:
    capacity_kwh: float = 360.0
    initial_kwh: float = 270.0
    reserve_kwh: float = 90.0
    max_charge_kw: float = 75.0
    max_discharge_kw: float = 60.0
    charge_efficiency: float = 0.94
    discharge_efficiency: float = 0.94

    def validate(self) -> None:
        for label, value in (
            ("Battery capacity", self.capacity_kwh),
            ("Initial battery energy", self.initial_kwh),
            ("Battery reserve", self.reserve_kwh),
            ("Maximum battery charge", self.max_charge_kw),
            ("Maximum battery discharge", self.max_discharge_kw),
            ("Battery charge efficiency", self.charge_efficiency),
            ("Battery discharge efficiency", self.discharge_efficiency),
        ):
            _validate_finite(label, value)
        if self.capacity_kwh <= 0:
            raise ValueError("Battery capacity must be positive")
        if not 0 <= self.reserve_kwh <= self.initial_kwh <= self.capacity_kwh:
            raise ValueError("Battery values must satisfy reserve <= initial <= capacity")
        if self.max_charge_kw <= 0 or self.max_discharge_kw <= 0:
            raise ValueError("Battery charge and discharge limits must be positive")
        if not 0 < self.charge_efficiency <= 1 or not 0 < self.discharge_efficiency <= 1:
            raise ValueError("Battery efficiencies must be in (0, 1]")


@dataclass(frozen=True)
class GeneratorConfig:
    id: str
    name: str
    capacity_kw: float
    minimum_kw: float
    liters_per_kwh: float = 0.28
    initially_available: bool = True
    ramp_up_kw_per_hour: float | None = None
    ramp_down_kw_per_hour: float | None = None
    min_up_hours: int = 0
    min_down_hours: int = 0
    start_fuel_liters: float = 0.0
    initial_on: bool = False
    initial_power_kw: float = 0.0
    initial_state_hours: int = 0

    def validate(self) -> None:
        for label, value in (
            ("Generator capacity", self.capacity_kw),
            ("Generator minimum output", self.minimum_kw),
            ("Generator fuel consumption", self.liters_per_kwh),
            ("Generator start fuel", self.start_fuel_liters),
            ("Initial generator output", self.initial_power_kw),
        ):
            _validate_finite(label, value)
        for label, value in (
            ("Generator ramp-up limit", self.ramp_up_kw_per_hour),
            ("Generator ramp-down limit", self.ramp_down_kw_per_hour),
        ):
            if value is not None:
                _validate_finite(label, value)
        if not self.id.strip() or not self.name.strip():
            raise ValueError("Generator id and name are required")
        if self.capacity_kw <= 0 or not 0 <= self.minimum_kw <= self.capacity_kw:
            raise ValueError(f"Invalid power range for generator {self.id}")
        if self.liters_per_kwh <= 0:
            raise ValueError(f"Fuel consumption must be positive for generator {self.id}")
        if self.start_fuel_liters < 0:
            raise ValueError(f"Start fuel cannot be negative for generator {self.id}")
        if any(
            isinstance(value, bool) or not isinstance(value, int) or value < 0
            for value in (self.min_up_hours, self.min_down_hours, self.initial_state_hours)
        ):
            raise ValueError(f"Generator operating durations must be non-negative whole hours for {self.id}")
        for label, value in (
            ("ramp-up", self.ramp_up_kw_per_hour),
            ("ramp-down", self.ramp_down_kw_per_hour),
        ):
            if value is not None and value <= 0:
                raise ValueError(f"Generator {label} limit must be positive for {self.id}")
        if not isinstance(self.initial_on, bool):
            raise ValueError(f"Initial on/off state must be boolean for generator {self.id}")
        if self.initial_on:
            if not self.initially_available:
                raise ValueError(f"Unavailable generator {self.id} cannot start on")
            if not self.minimum_kw <= self.initial_power_kw <= self.capacity_kw:
                raise ValueError(f"Initial output must be within the on-range for generator {self.id}")
        elif self.initial_power_kw != 0:
            raise ValueError(f"Initially-off generator {self.id} must have zero initial output")
        if (
            not self.initial_on
            and self.ramp_up_kw_per_hour is not None
            and self.ramp_up_kw_per_hour < self.minimum_kw
        ):
            raise ValueError(f"Ramp-up limit must reach minimum output when starting generator {self.id}")


@dataclass(frozen=True)
class LoadConfig:
    critical_kw: float = 28.0
    essential_kw: float = 22.0
    flexible_kw: float = 10.0
    heating_reference_temp_c: float = -15.0
    heating_kw_per_degree: float = 0.55

    def validate(self) -> None:
        for label, value in (
            ("Critical load", self.critical_kw),
            ("Essential load", self.essential_kw),
            ("Flexible load", self.flexible_kw),
            ("Heating reference temperature", self.heating_reference_temp_c),
            ("Heating sensitivity", self.heating_kw_per_degree),
        ):
            _validate_finite(label, value)
        if min(self.critical_kw, self.essential_kw, self.flexible_kw) < 0:
            raise ValueError("Station loads cannot be negative")
        if self.heating_kw_per_degree < 0:
            raise ValueError("Heating sensitivity cannot be negative")


@dataclass(frozen=True)
class MissionConfig:
    id: str
    name: str
    power_kw: float
    duration_hours: int
    start_hour: int
    priority: MissionPriority = MissionPriority.MEDIUM
    equipment: tuple[str, ...] = ()
    personnel: tuple[str, ...] = ()
    minimum_visibility_km: float = 0.0
    maximum_wind_kmh: float = 10_000.0
    non_electric_fuel_l: float = 0.0

    def validate(self, simulation_hours: int) -> None:
        _validate_hour("Mission start hour", self.start_hour)
        _validate_hour("Mission duration", self.duration_hours)
        for label, value in (
            ("Mission power", self.power_kw),
            ("Mission minimum visibility", self.minimum_visibility_km),
            ("Mission maximum wind", self.maximum_wind_kmh),
            ("Mission non-electric fuel", self.non_electric_fuel_l),
        ):
            _validate_finite(label, value)
        if not self.id.strip() or not self.name.strip():
            raise ValueError("Mission id and name are required")
        if not isinstance(self.priority, MissionPriority):
            raise ValueError(f"Mission {self.id} priority must be a MissionPriority")
        if self.power_kw <= 0 or self.duration_hours <= 0:
            raise ValueError(f"Mission {self.id} needs positive power and duration")
        if self.start_hour < 0 or self.start_hour + self.duration_hours > simulation_hours:
            raise ValueError(f"Mission {self.id} must fit inside the simulation window")
        if self.minimum_visibility_km < 0 or self.maximum_wind_kmh < 0:
            raise ValueError(f"Mission {self.id} has invalid weather limits")
        if self.non_electric_fuel_l < 0:
            raise ValueError(f"Mission {self.id} fuel use cannot be negative")


@dataclass(frozen=True)
class ResupplyConfig:
    arrival_hour: int = 24 * 12
    fuel_liters: float = 3000.0

    def validate(self, simulation_hours: int) -> None:
        _validate_hour("Resupply arrival hour", self.arrival_hour)
        _validate_finite("Resupply fuel", self.fuel_liters)
        if self.arrival_hour < 0:
            raise ValueError("Resupply arrival hour cannot be negative")
        if self.fuel_liters < 0:
            raise ValueError("Resupply fuel cannot be negative")


@dataclass(frozen=True)
class ScheduledEvent:
    id: str
    kind: EventKind
    hour: int
    duration_hours: int = 1
    target: str | None = None
    value: float = 0.0

    def validate(self, simulation_hours: int) -> None:
        _validate_hour("Event hour", self.hour)
        _validate_hour("Event duration", self.duration_hours)
        _validate_finite("Event value", self.value)
        if not self.id.strip():
            raise ValueError("Event id is required")
        if not isinstance(self.kind, EventKind):
            raise ValueError(f"Event {self.id} has an unsupported event kind")
        if not 0 <= self.hour < simulation_hours:
            raise ValueError(f"Event {self.id} must begin inside the simulation window")
        if self.duration_hours <= 0:
            raise ValueError(f"Event {self.id} duration must be positive")
        if self.kind is EventKind.GENERATOR_FAILURE and not self.target:
            raise ValueError("Generator failure event must name its target generator")
        if self.kind is EventKind.RESUPPLY_DELAY and self.value < 0:
            raise ValueError("Resupply delay cannot be negative")
        if self.kind is EventKind.RESUPPLY_DELAY and not float(self.value).is_integer():
            raise ValueError("Resupply delay must be a whole number of hours")


@dataclass(frozen=True)
class StationConfig:
    name: str = "Polar Station Alpha"
    solar_capacity_kw: float = 35.0
    wind_capacity_kw: float = 55.0
    battery: BatteryConfig = field(default_factory=BatteryConfig)
    generators: tuple[GeneratorConfig, ...] = field(
        default_factory=lambda: (
            GeneratorConfig("gen-1", "Generator 01", 100.0, 18.0),
            GeneratorConfig("gen-2", "Generator 02", 80.0, 15.0),
        )
    )
    loads: LoadConfig = field(default_factory=LoadConfig)
    initial_fuel_liters: float = 3000.0
    fuel_capacity_liters: float = 10000.0
    fuel_resupply: ResupplyConfig | None = field(
        default_factory=lambda: ResupplyConfig(fuel_liters=6000.0)
    )
    missions: tuple[MissionConfig, ...] = ()

    def validate(self, simulation_hours: int) -> None:
        for label, value in (
            ("Solar capacity", self.solar_capacity_kw),
            ("Wind capacity", self.wind_capacity_kw),
            ("Initial fuel inventory", self.initial_fuel_liters),
            ("Fuel tank capacity", self.fuel_capacity_liters),
        ):
            _validate_finite(label, value)
        if not self.name.strip():
            raise ValueError("Station name is required")
        if self.solar_capacity_kw < 0 or self.wind_capacity_kw < 0:
            raise ValueError("Renewable capacities cannot be negative")
        self.battery.validate()
        self.loads.validate()
        if not 0 <= self.initial_fuel_liters <= self.fuel_capacity_liters:
            raise ValueError("Fuel inventory must be within tank capacity")
        if self.fuel_capacity_liters <= 0:
            raise ValueError("Fuel tank capacity must be positive")
        ids = [generator.id for generator in self.generators]
        if len(ids) != len(set(ids)):
            raise ValueError("Generator ids must be unique")
        for generator in self.generators:
            generator.validate()
        mission_ids = [mission.id for mission in self.missions]
        if len(mission_ids) != len(set(mission_ids)):
            raise ValueError("Mission ids must be unique")
        for mission in self.missions:
            mission.validate(simulation_hours)
        if self.fuel_resupply is not None:
            self.fuel_resupply.validate(simulation_hours)


@dataclass(frozen=True)
class SimulationConfig:
    days: int = 30
    seed: int = 42
    start_time: str = "2032-01-01T00:00:00+00:00"
    station: StationConfig = field(default_factory=StationConfig)
    events: tuple[ScheduledEvent, ...] = ()

    @property
    def hours(self) -> int:
        return self.days * 24

    def validate(self) -> None:
        _validate_hour("Simulation duration in days", self.days)
        if isinstance(self.seed, bool) or not isinstance(self.seed, int):
            raise ValueError("Simulation seed must be an integer")
        if self.days <= 0 or self.days > 365:
            raise ValueError("Simulation duration must be between 1 and 365 days")
        if not isinstance(self.start_time, str):
            raise ValueError("start_time must be an ISO 8601 datetime string")
        try:
            start = datetime.fromisoformat(self.start_time)
        except ValueError as exc:
            raise ValueError("start_time must be an ISO 8601 datetime") from exc
        if start.tzinfo is None or start.utcoffset() is None:
            raise ValueError("start_time must include a UTC offset")
        self.station.validate(self.hours)
        event_ids = [event.id for event in self.events]
        if len(event_ids) != len(set(event_ids)):
            raise ValueError("Event ids must be unique")
        for event in self.events:
            event.validate(self.hours)
            if event.kind is EventKind.GENERATOR_FAILURE and event.target not in {
                generator.id for generator in self.station.generators
            }:
                raise ValueError(f"Event {event.id} targets an unknown generator")
            if event.kind is EventKind.RESUPPLY_DELAY and self.station.fuel_resupply is None:
                raise ValueError(f"Event {event.id} delays a resupply that is not configured")


@dataclass
class SimulationResult:
    station_name: str
    seed: int
    start_time: str
    end_time: str
    telemetry: list[dict[str, Any]]
    event_log: list[dict[str, Any]]
    mission_results: list[dict[str, Any]]
    summary: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
