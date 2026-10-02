"""Hourly deterministic station simulator with explicit energy accounting."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from collections.abc import Sequence
from typing import Any

from .models import EventKind, MissionConfig, SimulationConfig, SimulationResult, WeatherForcing


@dataclass(frozen=True)
class _Weather:
    regime: str
    temperature_c: float
    wind_kmh: float
    visibility_km: float
    solar_factor: float
    wind_factor: float


@dataclass
class _MissionState:
    status: str = "scheduled"
    reason: str | None = None
    energy_served_kwh: float = 0.0
    served_hours: int = 0


class SimulationEngine:
    """Run a reproducible hourly simulation from immutable configuration."""

    def run(
        self,
        config: SimulationConfig,
        *,
        weather_forcing: Sequence[WeatherForcing] | None = None,
    ) -> SimulationResult:
        config.validate()
        if weather_forcing is not None:
            if len(weather_forcing) != config.hours:
                raise ValueError("Weather forcing must contain exactly one item per simulation hour")
            for item in weather_forcing:
                if not isinstance(item, WeatherForcing):
                    raise ValueError("Weather forcing items must be WeatherForcing values")
                item.validate()
        rng = random.Random(config.seed)
        start = datetime.fromisoformat(config.start_time)
        station = config.station
        battery = station.battery
        battery_kwh = battery.initial_kwh
        fuel_liters = station.initial_fuel_liters
        mission_states = {mission.id: _MissionState() for mission in station.missions}
        generator_failed_until: dict[str, int] = {}
        event_log: list[dict[str, Any]] = []
        telemetry: list[dict[str, Any]] = []
        storm_windows: list[tuple[int, int]] = []
        resupply_hour = station.fuel_resupply.arrival_hour if station.fuel_resupply else None
        resupply_delivered = False
        mission_fuel_used = 0.0
        generator_fuel_used = 0.0
        energy_balance_max_error = 0.0
        weather_states = (
            [
                _Weather(
                    item.regime,
                    item.temperature_c,
                    item.wind_kmh,
                    item.visibility_km,
                    item.solar_factor,
                    item.wind_factor,
                )
                for item in weather_forcing
            ]
            if weather_forcing is not None
            else self._weather_series(config.hours, rng)
        )
        events_at_hour: dict[int, list[Any]] = {}
        for event in config.events:
            events_at_hour.setdefault(event.hour, []).append(event)

        for hour in range(config.hours):
            timestamp = start + timedelta(hours=hour)
            for generator_id, repair_hour in list(generator_failed_until.items()):
                if hour == repair_hour:
                    del generator_failed_until[generator_id]
                    event_log.append(
                        self._event_record(timestamp, "generator_recovered", generator_id,
                                           f"{generator_id} returned to service")
                    )

            for event in events_at_hour.get(hour, []):
                if event.kind is EventKind.GENERATOR_FAILURE:
                    repair_hour = min(hour + event.duration_hours, config.hours)
                    generator_failed_until[event.target] = max(
                        repair_hour, generator_failed_until.get(event.target, hour)
                    )
                    event_log.append(
                        self._event_record(timestamp, event.kind.value, event.target,
                                           f"{event.target} failed for {event.duration_hours} hours")
                    )
                elif event.kind is EventKind.STORM:
                    end_hour = min(hour + event.duration_hours, config.hours)
                    storm_windows.append((hour, end_hour))
                    event_log.append(
                        self._event_record(timestamp, event.kind.value, event.id,
                                           f"Storm conditions active through hour {end_hour}")
                    )
                elif event.kind is EventKind.RESUPPLY_DELAY:
                    if resupply_delivered:
                        message = "Fuel resupply was already delivered; arrival was unchanged"
                    elif resupply_hour is not None:
                        resupply_hour += int(event.value)
                        message = (f"Fuel resupply delayed by {int(event.value)} hours; "
                                   f"new arrival hour is {resupply_hour}")
                    else:
                        message = "No fuel resupply is scheduled; delay had no effect"
                    event_log.append(
                        self._event_record(timestamp, event.kind.value, event.id,
                                           message)
                    )

            if resupply_hour == hour and not resupply_delivered and station.fuel_resupply:
                delivered = min(
                    station.fuel_resupply.fuel_liters,
                    station.fuel_capacity_liters - fuel_liters,
                )
                fuel_liters += delivered
                resupply_delivered = True
                event_log.append(
                    self._event_record(timestamp, "resupply_arrived", "fuel-resupply",
                                       f"Received {delivered:.1f} L of fuel")
                )

            weather = weather_states[hour]
            if any(begin <= hour < end for begin, end in storm_windows):
                weather = self._storm_weather(rng)
            solar_kw = self._solar_output(station.solar_capacity_kw, weather, timestamp)
            wind_kw = self._wind_output(station.wind_capacity_kw, weather)

            running_missions = self._update_missions(
                station.missions,
                mission_states,
                hour,
                weather,
                fuel_liters,
                timestamp,
                event_log,
            )
            for mission in running_missions:
                if mission.start_hour == hour and mission.non_electric_fuel_l:
                    fuel_liters -= mission.non_electric_fuel_l
                    mission_fuel_used += mission.non_electric_fuel_l

            heating_kw = max(
                0.0,
                station.loads.heating_reference_temp_c - weather.temperature_c,
            ) * station.loads.heating_kw_per_degree
            requested_items: list[dict[str, Any]] = [
                {"key": "critical", "kind": "station", "priority": 0,
                 "requested_kw": station.loads.critical_kw},
                {"key": "essential", "kind": "station", "priority": 1,
                 "requested_kw": station.loads.essential_kw + heating_kw},
            ]
            for mission in running_missions:
                requested_items.append(
                    {"key": mission.id, "kind": "mission", "priority": 2 + int(mission.priority),
                     "requested_kw": mission.power_kw, "mission": mission}
                )
            requested_items.append(
                {"key": "flexible", "kind": "station", "priority": 20,
                 "requested_kw": station.loads.flexible_kw}
            )
            requested_items.sort(key=lambda item: (item["priority"], item["key"]))
            demand_kw = sum(item["requested_kw"] for item in requested_items)

            generator_output: dict[str, float] = {}
            generator_status: dict[str, str] = {}
            remaining_deficit = max(0.0, demand_kw - solar_kw - wind_kw)
            hour_generator_fuel = 0.0
            for generator in station.generators:
                unavailable = (
                    not generator.initially_available
                    or generator.id in generator_failed_until
                    or fuel_liters <= 0
                )
                if unavailable or remaining_deficit <= 1e-9:
                    generator_output[generator.id] = 0.0
                    generator_status[generator.id] = (
                        "failed" if generator.id in generator_failed_until
                        else "unavailable" if not generator.initially_available
                        else "fuel_depleted" if fuel_liters <= 0
                        else "standby"
                    )
                    continue
                target_kw = min(generator.capacity_kw,
                                max(generator.minimum_kw, remaining_deficit))
                fuel_limited_kw = fuel_liters / generator.liters_per_kwh
                if fuel_limited_kw + 1e-9 < generator.minimum_kw:
                    generator_output[generator.id] = 0.0
                    generator_status[generator.id] = "fuel_insufficient_for_minimum"
                    continue
                output_kw = min(target_kw, fuel_limited_kw)
                if output_kw <= 1e-9:
                    generator_output[generator.id] = 0.0
                    generator_status[generator.id] = "fuel_unavailable"
                    continue
                consumed = min(fuel_liters, output_kw * generator.liters_per_kwh)
                fuel_liters -= consumed
                hour_generator_fuel += consumed
                generator_fuel_used += consumed
                generator_output[generator.id] = output_kw
                generator_status[generator.id] = "running"
                remaining_deficit = max(0.0, remaining_deficit - output_kw)

            generator_kw = sum(generator_output.values())
            available_before_battery = solar_kw + wind_kw + generator_kw
            battery_discharge_kw = 0.0
            if available_before_battery + 1e-9 < demand_kw:
                usable_output = max(0.0, battery_kwh - battery.reserve_kwh) * battery.discharge_efficiency
                battery_discharge_kw = min(
                    demand_kw - available_before_battery,
                    battery.max_discharge_kw,
                    usable_output,
                )
                battery_kwh -= battery_discharge_kw / battery.discharge_efficiency

            remaining_supply = solar_kw + wind_kw + generator_kw + battery_discharge_kw
            served_kw = 0.0
            critical_requested = 0.0
            critical_served = 0.0
            mission_energy_requested = 0.0
            mission_energy_served = 0.0
            load_records: dict[str, dict[str, float | bool]] = {}
            for item in requested_items:
                requested = item["requested_kw"]
                if item["kind"] == "mission":
                    mission_energy_requested += requested
                    if remaining_supply + 1e-9 >= requested:
                        item_served = requested
                        remaining_supply -= item_served
                        mission_states[item["mission"].id].served_hours += 1
                        mission_states[item["mission"].id].energy_served_kwh += item_served
                        mission_energy_served += item_served
                    else:
                        item_served = 0.0
                        state = mission_states[item["mission"].id]
                        state.status = "failed"
                        state.reason = "Insufficient available power during the mission window"
                        event_log.append(
                            self._event_record(timestamp, "mission_power_shortfall",
                                               item["mission"].id, state.reason)
                        )
                else:
                    item_served = min(requested, remaining_supply)
                    remaining_supply -= item_served
                    if item["key"] == "critical":
                        critical_requested = requested
                        critical_served = item_served
                served_kw += item_served
                load_records[item["key"]] = {
                    "requested_kw": round(requested, 4),
                    "served_kw": round(item_served, 4),
                    "shed_kw": round(max(0.0, requested - item_served), 4),
                }

            battery_charge_kw = 0.0
            curtailed_kw = max(0.0, remaining_supply)
            if battery_discharge_kw <= 1e-9 and remaining_supply > 1e-9:
                charge_headroom_input = max(0.0, battery.capacity_kwh - battery_kwh) / battery.charge_efficiency
                battery_charge_kw = min(
                    remaining_supply,
                    battery.max_charge_kw,
                    charge_headroom_input,
                )
                battery_kwh += battery_charge_kw * battery.charge_efficiency
                curtailed_kw = max(0.0, remaining_supply - battery_charge_kw)

            battery_conversion_loss_kw = (
                battery_discharge_kw * (1 / battery.discharge_efficiency - 1)
                + battery_charge_kw * (1 - battery.charge_efficiency)
            )

            energy_in = solar_kw + wind_kw + generator_kw + battery_discharge_kw
            energy_out = served_kw + battery_charge_kw + curtailed_kw
            balance_error = energy_in - energy_out
            energy_balance_max_error = max(energy_balance_max_error, abs(balance_error))
            mission_failures = [
                mission.id for mission in running_missions
                if mission_states[mission.id].status == "failed"
            ]
            for mission in running_missions:
                state = mission_states[mission.id]
                if state.status == "running" and hour + 1 >= mission.start_hour + mission.duration_hours:
                    state.status = "completed" if state.served_hours == mission.duration_hours else "failed"
                    if state.status == "failed" and not state.reason:
                        state.reason = "Mission did not receive its full required power for every hour"
                    event_log.append(
                        self._event_record(timestamp, f"mission_{state.status}", mission.id,
                                           state.reason or f"{mission.name} finished")
                    )

            soc_percent = 100.0 * battery_kwh / battery.capacity_kwh
            telemetry.append(
                {
                    "hour": hour,
                    "timestamp": timestamp.isoformat(),
                    "weather_regime": weather.regime,
                    "temperature_c": round(weather.temperature_c, 2),
                    "wind_kmh": round(weather.wind_kmh, 2),
                    "visibility_km": round(weather.visibility_km, 2),
                    "solar_kw": round(solar_kw, 4),
                    "wind_kw": round(wind_kw, 4),
                    "renewable_kw": round(solar_kw + wind_kw, 4),
                    "generator_output_kw": {key: round(value, 4) for key, value in generator_output.items()},
                    "generator_status": generator_status,
                    "demand_kw": round(demand_kw, 4),
                    "served_kw": round(served_kw, 4),
                    "critical_requested_kw": round(critical_requested, 4),
                    "critical_served_kw": round(critical_served, 4),
                    "critical_violation": critical_served + 1e-9 < critical_requested,
                    "mission_energy_requested_kw": round(mission_energy_requested, 4),
                    "mission_energy_served_kw": round(mission_energy_served, 4),
                    "mission_failures": mission_failures,
                    "load_breakdown": load_records,
                    "battery_kwh": round(battery_kwh, 4),
                    "battery_soc_percent": round(soc_percent, 2),
                    "battery_charge_kw": round(battery_charge_kw, 4),
                    "battery_discharge_kw": round(battery_discharge_kw, 4),
                    "battery_conversion_loss_kw": round(battery_conversion_loss_kw, 4),
                    "fuel_liters": round(fuel_liters, 4),
                    "fuel_consumed_liters": round(hour_generator_fuel, 4),
                    "mission_fuel_used_liters": round(
                        sum(m.non_electric_fuel_l for m in running_missions if m.start_hour == hour), 4
                    ),
                    "resupply_arrival_hour": resupply_hour,
                    "energy_balance_error_kw": round(balance_error, 8),
                    "curtailed_kw": round(curtailed_kw, 4),
                }
            )

        for index, row in enumerate(telemetry):
            window_start = max(0, index - 23)
            window = telemetry[window_start:index + 1]
            elapsed_hours = len(window)
            recent_fuel_rate = sum(
                item["fuel_consumed_liters"] + item["mission_fuel_used_liters"]
                for item in window
            ) / elapsed_hours
            row["fuel_runway_hours"] = (
                round(row["fuel_liters"] / recent_fuel_rate, 2)
                if recent_fuel_rate > 1e-9 else None
            )

        end = start + timedelta(hours=config.hours)
        mission_results = [
            {
                "id": mission.id,
                "name": mission.name,
                "status": mission_states[mission.id].status,
                "reason": mission_states[mission.id].reason,
                "required_energy_kwh": round(mission.power_kw * mission.duration_hours, 4),
                "served_energy_kwh": round(mission_states[mission.id].energy_served_kwh, 4),
                "served_hours": mission_states[mission.id].served_hours,
                "duration_hours": mission.duration_hours,
                "scheduled_start_hour": mission.start_hour,
            }
            for mission in station.missions
        ]
        total_demand = sum(row["demand_kw"] for row in telemetry)
        total_served = sum(row["served_kw"] for row in telemetry)
        total_renewable = sum(row["renewable_kw"] for row in telemetry)
        total_generator = sum(sum(row["generator_output_kw"].values()) for row in telemetry)
        total_fuel = generator_fuel_used + mission_fuel_used
        summary = {
            "duration_hours": config.hours,
            "renewable_energy_kwh": round(total_renewable, 3),
            "generator_energy_kwh": round(total_generator, 3),
            "demand_energy_kwh": round(total_demand, 3),
            "served_energy_kwh": round(total_served, 3),
            "unserved_energy_kwh": round(total_demand - total_served, 3),
            "renewable_share_percent": round(
                100 * total_renewable / max(1e-9, total_renewable + total_generator), 2
            ),
            "generator_fuel_consumed_liters": round(generator_fuel_used, 3),
            "mission_fuel_consumed_liters": round(mission_fuel_used, 3),
            "total_fuel_consumed_liters": round(total_fuel, 3),
            "fuel_remaining_liters": round(fuel_liters, 3),
            "fuel_runway_hours_at_end": telemetry[-1]["fuel_runway_hours"],
            "battery_conversion_loss_kwh": round(
                sum(row["battery_conversion_loss_kw"] for row in telemetry), 3
            ),
            "resupply_delivered": resupply_delivered,
            "resupply_arrival_hour": resupply_hour,
            "mission_count": len(mission_results),
            "missions_completed": sum(result["status"] == "completed" for result in mission_results),
            "missions_deferred": sum(result["status"] == "deferred" for result in mission_results),
            "missions_failed": sum(result["status"] == "failed" for result in mission_results),
            "critical_violation_hours": sum(row["critical_violation"] for row in telemetry),
            "battery_min_kwh": round(min(row["battery_kwh"] for row in telemetry), 3),
            "battery_final_kwh": round(battery_kwh, 3),
            "energy_balance_max_error_kw": round(energy_balance_max_error, 8),
            "event_count": len(event_log),
        }
        return SimulationResult(
            station_name=station.name,
            seed=config.seed,
            start_time=start.isoformat(),
            end_time=end.isoformat(),
            telemetry=telemetry,
            event_log=event_log,
            mission_results=mission_results,
            summary=summary,
        )

    @staticmethod
    def _weather_series(hours: int, rng: random.Random) -> list[_Weather]:
        """Use persistent six-hour regimes for temporally correlated weather."""
        regimes: list[str] = []
        current = "clear"
        for hour in range(hours):
            if hour and hour % 6 == 0:
                roll = rng.random()
                if current == "clear":
                    current = "cloudy" if roll < 0.30 else "storm" if roll < 0.34 else "clear"
                elif current == "cloudy":
                    current = "clear" if roll < 0.25 else "storm" if roll < 0.38 else "cloudy"
                else:
                    current = "clear" if roll < 0.25 else "cloudy" if roll < 0.75 else "storm"
            regimes.append(current)
        result: list[_Weather] = []
        for regime in regimes:
            if regime == "clear":
                result.append(_Weather(regime, -25.0 + rng.uniform(-2, 2),
                                       rng.uniform(22, 43), rng.uniform(3.2, 7.0), 0.95, 0.58))
            elif regime == "cloudy":
                result.append(_Weather(regime, -23.0 + rng.uniform(-2, 2),
                                       rng.uniform(25, 48), rng.uniform(2.4, 5.0), 0.34, 0.72))
            else:
                result.append(SimulationEngine._storm_weather(rng))
        return result

    @staticmethod
    def _storm_weather(rng: random.Random) -> _Weather:
        wind = rng.uniform(92, 110)
        return _Weather("storm", -30.0 + rng.uniform(-3, 2), wind,
                        rng.uniform(0.2, 1.3), 0.08, 0.0)

    @staticmethod
    def _solar_output(capacity_kw: float, weather: _Weather, timestamp: datetime) -> float:
        utc_time = timestamp.astimezone(timezone.utc)
        hour = utc_time.hour + utc_time.minute / 60
        daylight = max(0.0, min(1.0, math.sin(math.pi * (hour - 6) / 12)))
        return capacity_kw * daylight * weather.solar_factor

    @staticmethod
    def _wind_output(capacity_kw: float, weather: _Weather) -> float:
        if weather.wind_kmh >= 90:
            return 0.0
        wind_curve = min(1.0, weather.wind_kmh / 50.0)
        return capacity_kw * weather.wind_factor * wind_curve

    @staticmethod
    def _update_missions(
        missions: tuple[MissionConfig, ...],
        states: dict[str, _MissionState],
        hour: int,
        weather: _Weather,
        available_fuel_liters: float,
        timestamp: datetime,
        event_log: list[dict[str, Any]],
    ) -> list[MissionConfig]:
        running_before = [mission for mission in missions if states[mission.id].status == "running"]
        active_equipment = {item for mission in running_before for item in mission.equipment}
        active_personnel = {item for mission in running_before for item in mission.personnel}
        candidates = sorted(
            (mission for mission in missions
             if mission.start_hour == hour and states[mission.id].status == "scheduled"),
            key=lambda mission: (int(mission.priority), mission.id),
        )
        running = list(running_before)
        reserved_fuel = 0.0
        for mission in candidates:
            reason = None
            if weather.visibility_km < mission.minimum_visibility_km:
                reason = f"Visibility {weather.visibility_km:.1f} km is below mission minimum"
            elif weather.wind_kmh > mission.maximum_wind_kmh:
                reason = f"Wind {weather.wind_kmh:.1f} km/h exceeds mission limit"
            elif any(resource in active_equipment for resource in mission.equipment):
                reason = "Required equipment is assigned to another active mission"
            elif any(person in active_personnel for person in mission.personnel):
                reason = "Required personnel are assigned to another active mission"
            elif mission.non_electric_fuel_l > available_fuel_liters - reserved_fuel:
                reason = "Insufficient fuel for the mission's non-electric operations"
            if reason:
                states[mission.id].status = "deferred"
                states[mission.id].reason = reason
                event_log.append(
                    SimulationEngine._event_record(timestamp, "mission_deferred", mission.id, reason)
                )
                continue
            states[mission.id].status = "running"
            running.append(mission)
            active_equipment.update(mission.equipment)
            active_personnel.update(mission.personnel)
            reserved_fuel += mission.non_electric_fuel_l
            event_log.append(
                SimulationEngine._event_record(timestamp, "mission_started", mission.id,
                                               f"{mission.name} started as scheduled")
            )

        for mission in running:
            if weather.visibility_km < mission.minimum_visibility_km or weather.wind_kmh > mission.maximum_wind_kmh:
                state = states[mission.id]
                state.status = "failed"
                state.reason = "Weather moved outside mission operating limits"
                event_log.append(
                    SimulationEngine._event_record(timestamp, "mission_weather_interruption",
                                                   mission.id, state.reason)
                )
        return [mission for mission in running if states[mission.id].status == "running"]

    @staticmethod
    def _event_record(timestamp: datetime, kind: str, subject: str, message: str) -> dict[str, str]:
        return {
            "timestamp": timestamp.isoformat(),
            "kind": kind,
            "subject": subject,
            "message": message,
        }
