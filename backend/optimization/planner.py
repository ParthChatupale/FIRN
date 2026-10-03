"""Small, inspectable MILP prototype for mission timing and energy dispatch.

The model is intentionally limited to one station, one deterministic weather
trajectory, hourly operation, and the constraints represented by the current
domain model. It is a proposal generator, not a controller.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import replace
import math
from time import perf_counter
from typing import Any

from backend.simulation import (
    EventKind,
    MissionConfig,
    MissionPriority,
    SimulationConfig,
    SimulationEngine,
    SimulationResult,
    WeatherForcing,
)


def _priority_score(priority: MissionPriority) -> float:
    # Explicit initial heuristic. Domain science-value weights are not modeled yet.
    return float(4 - int(priority))


def _normalise_start_options(
    config: SimulationConfig,
    start_options: Mapping[str, Sequence[int]] | None,
    flexibility_hours: int,
) -> dict[str, tuple[int, ...]]:
    missions = {mission.id: mission for mission in config.station.missions}
    if start_options is not None and set(start_options) - set(missions):
        unknown = sorted(set(start_options) - set(missions))
        raise ValueError(f"Start options include unknown missions: {', '.join(unknown)}")
    options: dict[str, tuple[int, ...]] = {}
    for mission in config.station.missions:
        proposed = (
            start_options[mission.id]
            if start_options is not None and mission.id in start_options
            else range(
                max(0, mission.start_hour - flexibility_hours),
                min(config.hours - mission.duration_hours, mission.start_hour + flexibility_hours) + 1,
            )
        )
        values = tuple(sorted(set(proposed)))
        if any(isinstance(hour, bool) or not isinstance(hour, int) for hour in values):
            raise ValueError(f"Start options for {mission.id} must be whole hours")
        if any(hour < 0 or hour + mission.duration_hours > config.hours for hour in values):
            raise ValueError(f"Start options for {mission.id} fall outside the planning horizon")
        options[mission.id] = values
    return options


def _effective_resupply(config: SimulationConfig) -> tuple[int | None, list[str]]:
    resupply = config.station.fuel_resupply
    if resupply is None:
        return None, []
    arrival_hour = resupply.arrival_hour
    applied_events: list[str] = []
    for event in sorted(config.events, key=lambda item: (item.hour, item.id)):
        if event.kind is EventKind.RESUPPLY_DELAY and event.hour <= arrival_hour:
            arrival_hour += int(event.value)
            applied_events.append(event.id)
    return arrival_hour, applied_events


def _scenario_envelope_rows(
    engine: SimulationEngine,
    config: SimulationConfig,
    scenarios: Mapping[str, Sequence[WeatherForcing]],
) -> tuple[list[dict[str, Any]], SimulationResult, list[str]]:
    if len(scenarios) < 2:
        raise ValueError("Robust planning requires at least two named weather scenarios")
    if any(not isinstance(name, str) for name in scenarios):
        raise ValueError("Weather scenario names must be strings")
    names = sorted(scenarios)
    if any(not name.strip() for name in names):
        raise ValueError("Weather scenario names cannot be empty")
    results = {
        name: engine.run(config, weather_forcing=scenarios[name])
        for name in names
    }
    scenario_rows = {name: result.telemetry for name, result in results.items()}
    envelope: list[dict[str, Any]] = []
    for hour in range(config.hours):
        rows = [scenario_rows[name][hour] for name in names]
        row = dict(rows[0])
        row["temperature_c"] = min(item["temperature_c"] for item in rows)
        row["wind_kmh"] = max(item["wind_kmh"] for item in rows)
        row["visibility_km"] = min(item["visibility_km"] for item in rows)
        row["renewable_kw"] = min(item["renewable_kw"] for item in rows)
        row["generator_status"] = {
            generator.id: (
                "failed"
                if any(item["generator_status"].get(generator.id) == "failed" for item in rows)
                else rows[0]["generator_status"].get(generator.id, "standby")
            )
            for generator in config.station.generators
        }
        envelope.append(row)
    return envelope, results[names[0]], names


def optimize_schedule(
    config: SimulationConfig,
    *,
    start_options: Mapping[str, Sequence[int]] | None = None,
    flexibility_hours: int = 12,
    mission_values: Mapping[str, float] | None = None,
    weather_forcing: Sequence[WeatherForcing] | None = None,
    weather_scenarios: Mapping[str, Sequence[WeatherForcing]] | None = None,
    latest_finish_hours: Mapping[str, int] | None = None,
    precedence: Sequence[tuple[str, str]] = (),
    terminal_soc_kwh: float | None = None,
) -> dict[str, Any]:
    """Optimize mission selection/timing and hourly resource dispatch with a MILP.

    The model lexicographically maximizes a priority-weighted mission score, then
    minimizes generator fuel while preserving that score. Omitted mission values
    use a transparent priority-only heuristic, not empirical science value.
    """
    try:
        import pyomo.environ as pyo
        from pyomo.opt import TerminationCondition
    except ImportError as exc:  # pragma: no cover - exercised in environments without the extra
        raise RuntimeError(
            "Optimization dependencies are missing; install the project with its [optimization] extra"
        ) from exc

    config.validate()
    if isinstance(flexibility_hours, bool) or not isinstance(flexibility_hours, int) or flexibility_hours < 0:
        raise ValueError("Mission flexibility must be a non-negative whole number of hours")
    if weather_forcing is not None and weather_scenarios is not None:
        raise ValueError("Provide either one weather_forcing trajectory or weather_scenarios, not both")
    missions = list(config.station.missions)
    mission_by_id = {mission.id: mission for mission in missions}
    if latest_finish_hours is not None and set(latest_finish_hours) - set(mission_by_id):
        raise ValueError("Deadlines include an unknown mission id")
    if any(
        isinstance(hour, bool) or not isinstance(hour, int) or not 0 < hour <= config.hours
        for hour in (latest_finish_hours or {}).values()
    ):
        raise ValueError("Mission deadlines must be whole-hour finish times within the planning horizon")
    for pair in precedence:
        if len(pair) != 2 or pair[0] not in mission_by_id or pair[1] not in mission_by_id:
            raise ValueError("Precedence rules must reference two known mission ids")
        if pair[0] == pair[1]:
            raise ValueError("A mission cannot precede itself")
    if mission_values is not None and set(mission_values) - set(mission_by_id):
        raise ValueError("Mission values include an unknown mission id")
    values = {}
    for mission in missions:
        raw_value = (
            mission_values[mission.id]
            if mission_values is not None and mission.id in mission_values
            else _priority_score(mission.priority)
        )
        if isinstance(raw_value, bool):
            raise ValueError("Mission values must be finite and positive numbers")
        values[mission.id] = float(raw_value)
    if any(not math.isfinite(value) or value <= 0 for value in values.values()):
        raise ValueError("Mission values must be finite and positive")

    options = _normalise_start_options(config, start_options, flexibility_hours)
    deadline_rejections: dict[str, int] = {}
    for mission in missions:
        deadline = (latest_finish_hours or {}).get(mission.id)
        if deadline is not None:
            before = len(options[mission.id])
            options[mission.id] = tuple(
                hour for hour in options[mission.id]
                if hour + mission.duration_hours <= deadline
            )
            deadline_rejections[mission.id] = before - len(options[mission.id])
    engine = SimulationEngine()
    scenario_names: list[str] = []
    if weather_scenarios is not None:
        rows, reference_result, scenario_names = _scenario_envelope_rows(
            engine, config, weather_scenarios
        )
        replay_weather = weather_scenarios[scenario_names[0]]
        uncertainty_assessment = {
            "mode": "deterministic_worst_case_envelope",
            "scenario_names": scenario_names,
            "probabilistic": False,
            "method": (
                "Per-hour minimum renewable output, coldest temperature, lowest visibility, "
                "and highest wind across the supplied scenarios."
            ),
            "replay_scenario": scenario_names[0],
        }
    else:
        reference_result = engine.run(config, weather_forcing=weather_forcing)
        rows = reference_result.telemetry
        replay_weather = weather_forcing
        uncertainty_assessment = {
            "mode": "single_trajectory",
            "scenario_names": [],
            "probabilistic": False,
        }
    hours = config.hours
    station = config.station
    battery = station.battery
    if terminal_soc_kwh is not None and (
        isinstance(terminal_soc_kwh, bool)
        or not isinstance(terminal_soc_kwh, (int, float))
        or not math.isfinite(terminal_soc_kwh)
    ):
        raise ValueError("Terminal battery target must be a finite number")
    terminal_soc_target = battery.initial_kwh if terminal_soc_kwh is None else float(terminal_soc_kwh)
    if not battery.reserve_kwh <= terminal_soc_target <= battery.capacity_kwh:
        raise ValueError("Terminal battery target must be between protected reserve and capacity")
    effective_resupply_hour, applied_resupply_delays = _effective_resupply(config)
    generators = list(station.generators)
    candidate_pairs: list[tuple[str, int]] = []
    rejected_by_weather: dict[str, int] = {mission.id: 0 for mission in missions}
    for mission in missions:
        for start_hour in options[mission.id]:
            valid_weather = all(
                rows[hour]["visibility_km"] >= mission.minimum_visibility_km
                and rows[hour]["wind_kmh"] <= mission.maximum_wind_kmh
                for hour in range(start_hour, start_hour + mission.duration_hours)
            )
            if valid_weather:
                candidate_pairs.append((mission.id, start_hour))
            else:
                rejected_by_weather[mission.id] += 1

    model = pyo.ConcreteModel("FIRN_joint_mission_energy_prototype")
    model.H = pyo.RangeSet(0, hours - 1)
    model.T = pyo.RangeSet(0, hours)
    model.M = pyo.Set(initialize=[mission.id for mission in missions], ordered=True)
    model.G = pyo.Set(initialize=[generator.id for generator in generators], ordered=True)
    model.C = pyo.Set(dimen=2, initialize=candidate_pairs, ordered=True)
    model.x = pyo.Var(model.C, domain=pyo.Binary)
    model.selected = pyo.Var(model.M, domain=pyo.Binary)
    model.generator_on = pyo.Var(model.G, model.H, domain=pyo.Binary)
    model.generator_start = pyo.Var(model.G, model.H, domain=pyo.Binary)
    model.generator_stop = pyo.Var(model.G, model.H, domain=pyo.Binary)
    model.generator_kw = pyo.Var(
        model.G,
        model.H,
        domain=pyo.NonNegativeReals,
        bounds=lambda m, g, h: (0, next(gen.capacity_kw for gen in generators if gen.id == g)),
    )
    model.renewable_used_kw = pyo.Var(
        model.H,
        domain=pyo.NonNegativeReals,
        bounds=lambda m, h: (0, rows[h]["renewable_kw"]),
    )
    model.curtailed_kw = pyo.Var(model.H, domain=pyo.NonNegativeReals)
    model.charge_kw = pyo.Var(model.H, domain=pyo.NonNegativeReals, bounds=(0, battery.max_charge_kw))
    model.discharge_kw = pyo.Var(model.H, domain=pyo.NonNegativeReals, bounds=(0, battery.max_discharge_kw))
    model.battery_charging = pyo.Var(model.H, domain=pyo.Binary)
    model.soc_kwh = pyo.Var(
        model.T, domain=pyo.NonNegativeReals, bounds=(battery.reserve_kwh, battery.capacity_kwh)
    )
    model.fuel_liters = pyo.Var(
        model.T, domain=pyo.NonNegativeReals, bounds=(0, station.fuel_capacity_liters)
    )
    model.constraints = pyo.ConstraintList()

    model.constraints.add(model.soc_kwh[0] == battery.initial_kwh)
    model.constraints.add(model.fuel_liters[0] == station.initial_fuel_liters)
    model.constraints.add(model.soc_kwh[hours] >= terminal_soc_target)
    for mission in missions:
        model.constraints.add(
            sum(model.x[mission.id, start] for mid, start in candidate_pairs if mid == mission.id)
            == model.selected[mission.id]
        )
    for predecessor_id, successor_id in precedence:
        model.constraints.add(model.selected[successor_id] <= model.selected[predecessor_id])
        predecessor = mission_by_id[predecessor_id]
        successor = mission_by_id[successor_id]
        predecessor_start = sum(
            start * model.x[mid, start]
            for mid, start in candidate_pairs if mid == predecessor_id
        )
        successor_start = sum(
            start * model.x[mid, start]
            for mid, start in candidate_pairs if mid == successor_id
        )
        big_m = config.hours + predecessor.duration_hours
        model.constraints.add(
            successor_start >= predecessor_start + predecessor.duration_hours
            - big_m * (1 - model.selected[successor_id])
        )
    for generator in generators:
        ramp_up = generator.ramp_up_kw_per_hour or generator.capacity_kw
        ramp_down = generator.ramp_down_kw_per_hour or generator.capacity_kw
        for hour in range(hours):
            failed = rows[hour]["generator_status"].get(generator.id) == "failed"
            available = generator.initially_available and not failed
            previous_on = (
                int(generator.initial_on)
                if hour == 0
                else model.generator_on[generator.id, hour - 1]
            )
            previous_power = (
                generator.initial_power_kw
                if hour == 0
                else model.generator_kw[generator.id, hour - 1]
            )
            model.constraints.add(
                model.generator_on[generator.id, hour] - previous_on
                == model.generator_start[generator.id, hour] - model.generator_stop[generator.id, hour]
            )
            model.constraints.add(
                model.generator_start[generator.id, hour]
                + model.generator_stop[generator.id, hour]
                <= 1
            )
            if not available:
                model.constraints.add(model.generator_on[generator.id, hour] == 0)
                model.constraints.add(model.generator_kw[generator.id, hour] == 0)
                model.constraints.add(model.generator_start[generator.id, hour] == 0)
                model.constraints.add(
                    model.generator_stop[generator.id, hour] == previous_on
                )
            else:
                model.constraints.add(
                    model.generator_kw[generator.id, hour] <= generator.capacity_kw * model.generator_on[generator.id, hour]
                )
                model.constraints.add(
                    model.generator_kw[generator.id, hour] >= generator.minimum_kw * model.generator_on[generator.id, hour]
                )
                model.constraints.add(
                    model.generator_kw[generator.id, hour] <= previous_power + ramp_up
                )
                model.constraints.add(
                    model.generator_kw[generator.id, hour]
                    >= previous_power - ramp_down - generator.capacity_kw * model.generator_stop[generator.id, hour]
                )

                if hour == 0:
                    remaining_initial_up = max(0, generator.min_up_hours - generator.initial_state_hours)
                    remaining_initial_down = max(0, generator.min_down_hours - generator.initial_state_hours)
                    if generator.initial_on:
                        for future_hour in range(min(remaining_initial_up, hours)):
                            if rows[future_hour]["generator_status"].get(generator.id) != "failed":
                                model.constraints.add(model.generator_on[generator.id, future_hour] == 1)
                    else:
                        for future_hour in range(min(remaining_initial_down, hours)):
                            if rows[future_hour]["generator_status"].get(generator.id) != "failed":
                                model.constraints.add(model.generator_on[generator.id, future_hour] == 0)

                for future_hour in range(hour + 1, min(hours, hour + generator.min_up_hours)):
                    if rows[future_hour]["generator_status"].get(generator.id) != "failed":
                        model.constraints.add(
                            model.generator_on[generator.id, future_hour]
                            >= model.generator_start[generator.id, hour]
                        )
                for future_hour in range(hour + 1, min(hours, hour + generator.min_down_hours)):
                    if rows[future_hour]["generator_status"].get(generator.id) != "failed":
                        model.constraints.add(
                            model.generator_on[generator.id, future_hour]
                            <= 1 - model.generator_stop[generator.id, hour]
                        )

    resource_ids = sorted({
        resource
        for mission in missions
        for resource in (*mission.equipment, *mission.personnel)
    })
    for resource in resource_ids:
        for hour in range(hours):
            active = [
                model.x[mid, start]
                for mid, start in candidate_pairs
                if resource in (
                    *mission_by_id[mid].equipment,
                    *mission_by_id[mid].personnel,
                )
                and start <= hour < start + mission_by_id[mid].duration_hours
            ]
            if active:
                model.constraints.add(sum(active) <= 1)

    active_lookup: dict[tuple[str, int], list[tuple[str, int]]] = {}
    for pair in candidate_pairs:
        mid, start = pair
        mission = mission_by_id[mid]
        for hour in range(start, start + mission.duration_hours):
            active_lookup.setdefault((mid, hour), []).append(pair)

    model.resupply_delivery_liters = pyo.Var(
        model.T,
        domain=pyo.NonNegativeReals,
        bounds=(0, station.fuel_capacity_liters),
    )
    model.resupply_full_shipment = pyo.Var(model.H, domain=pyo.Binary)
    resupply = station.fuel_resupply
    for hour in range(hours + 1):
        if (
            resupply is None
            or effective_resupply_hour is None
            or effective_resupply_hour >= hours
            or hour != effective_resupply_hour
        ):
            model.constraints.add(model.resupply_delivery_liters[hour] == 0)
            continue
        shipment = min(resupply.fuel_liters, station.fuel_capacity_liters)
        full_shipment = model.resupply_full_shipment[hour]
        headroom = station.fuel_capacity_liters - model.fuel_liters[hour]
        big_m = station.fuel_capacity_liters
        delivery = model.resupply_delivery_liters[hour]
        model.constraints.add(delivery <= shipment)
        model.constraints.add(delivery <= headroom)
        model.constraints.add(delivery >= shipment - big_m * (1 - full_shipment))
        model.constraints.add(delivery >= headroom - big_m * full_shipment)
        model.constraints.add(headroom >= shipment - big_m * (1 - full_shipment))
        model.constraints.add(headroom <= shipment + big_m * full_shipment)
    modeled_baseline_demand: dict[int, float] = {}
    for hour in range(hours):
        demand = (
            station.loads.critical_kw
            + station.loads.essential_kw
            + station.loads.flexible_kw
            + max(0.0, station.loads.heating_reference_temp_c - rows[hour]["temperature_c"])
            * station.loads.heating_kw_per_degree
        )
        modeled_baseline_demand[hour] = demand
        mission_power = sum(
            mission_by_id[mid].power_kw * model.x[pair]
            for (mid, active_hour), pairs in active_lookup.items()
            if active_hour == hour
            for pair in pairs
        )
        mission_fuel = sum(
            mission_by_id[mid].non_electric_fuel_l * model.x[mid, start]
            for mid, start in candidate_pairs
            if start == hour
        )
        model.constraints.add(
            model.renewable_used_kw[hour]
            + sum(model.generator_kw[gen.id, hour] for gen in generators)
            + model.discharge_kw[hour]
            == demand + mission_power + model.charge_kw[hour] + model.curtailed_kw[hour]
        )
        model.constraints.add(model.charge_kw[hour] <= battery.max_charge_kw * model.battery_charging[hour])
        model.constraints.add(
            model.discharge_kw[hour] <= battery.max_discharge_kw * (1 - model.battery_charging[hour])
        )
        model.constraints.add(
            model.soc_kwh[hour + 1]
            == model.soc_kwh[hour]
            + battery.charge_efficiency * model.charge_kw[hour]
            - model.discharge_kw[hour] / battery.discharge_efficiency
        )
        generator_fuel = sum(
            generator.liters_per_kwh * model.generator_kw[generator.id, hour]
            for generator in generators
        ) + sum(
            generator.start_fuel_liters * model.generator_start[generator.id, hour]
            for generator in generators
        )
        model.constraints.add(
            model.fuel_liters[hour + 1]
            == model.fuel_liters[hour] + model.resupply_delivery_liters[hour] - generator_fuel - mission_fuel
        )

    mission_score = sum(values[mission.id] * model.selected[mission.id] for mission in missions)
    model.primary_objective = pyo.Objective(expr=mission_score, sense=pyo.maximize)
    solver = pyo.SolverFactory("appsi_highs")
    if not solver.available(exception_flag=False):
        raise RuntimeError("HiGHS solver is unavailable; install project [optimization] dependencies")
    solver.config.time_limit = 30
    # Avoid Pyomo raising before we can inspect a genuine infeasible solve.
    solver.config.load_solution = False
    solve_started = perf_counter()
    first_result = solver.solve(model, load_solutions=False)
    solver_solve_seconds = perf_counter() - solve_started
    first_status = first_result.solver.termination_condition
    if first_status == TerminationCondition.infeasible:
        bottlenecks = []
        for hour, row in enumerate(rows):
            demand_kw = (
                station.loads.critical_kw + station.loads.essential_kw + station.loads.flexible_kw
                + max(0.0, station.loads.heating_reference_temp_c - row["temperature_c"])
                * station.loads.heating_kw_per_degree
            )
            available_kw = row["renewable_kw"] + sum(
                generator.capacity_kw
                for generator in generators
                if generator.initially_available and row["generator_status"].get(generator.id) != "failed"
            ) + battery.max_discharge_kw
            if demand_kw > available_kw + 1e-7:
                bottlenecks.append({
                    "hour": hour,
                    "baseline_demand_kw": round(demand_kw, 4),
                    "maximum_instantaneous_supply_kw": round(available_kw, 4),
                    "shortfall_kw": round(demand_kw - available_kw, 4),
                })
        return {
            "status": "infeasible",
            "solver": "HiGHS",
            "reason": "No schedule satisfies the modeled mission, energy balance, fuel, battery, and shared-resource constraints.",
            "uncertainty_assessment": uncertainty_assessment,
            "terminal_soc_target_kwh": terminal_soc_target,
            "diagnostics": {
                "likely_power_bottlenecks": bottlenecks[:12],
                "missions_without_weather_and_deadline_eligible_starts": [
                    mission.id for mission in missions
                    if not any(mid == mission.id for mid, _start in candidate_pairs)
                ],
                "precedence_rules": [list(rule) for rule in precedence],
                "note": "These are targeted indicators, not a solver IIS or proof of a minimal conflicting constraint set.",
            },
        }
    if first_status not in (TerminationCondition.optimal, TerminationCondition.feasible):
        return {
            "status": "solver_limit",
            "solver": "HiGHS",
            "reason": str(first_status),
            "uncertainty_assessment": uncertainty_assessment,
            "terminal_soc_target_kwh": terminal_soc_target,
        }

    solver.load_vars()
    optimum_score = round(pyo.value(mission_score), 8)
    model.primary_objective.deactivate()
    # Empty checkpoint horizons (all planned missions are complete) still need
    # an energy/fuel dispatch solve; do not add the Python boolean ``0 == 0``.
    if missions:
        model.constraints.add(mission_score == optimum_score)
    model.fuel_objective = pyo.Objective(
        expr=(
            sum(
                generator.liters_per_kwh * model.generator_kw[generator.id, hour]
                for generator in generators
                for hour in range(hours)
            )
            + sum(
                generator.start_fuel_liters * model.generator_start[generator.id, hour]
                for generator in generators
                for hour in range(hours)
            )
        ),
        sense=pyo.minimize,
    )
    solve_started = perf_counter()
    second_result = solver.solve(model, load_solutions=False)
    solver_solve_seconds += perf_counter() - solve_started
    final_status = second_result.solver.termination_condition
    if final_status not in (TerminationCondition.optimal, TerminationCondition.feasible):
        return {
            "status": "solver_limit",
            "solver": "HiGHS",
            "reason": str(final_status),
            "uncertainty_assessment": uncertainty_assessment,
            "terminal_soc_target_kwh": terminal_soc_target,
        }
    solver.load_vars()

    schedule: list[dict[str, Any]] = []
    scheduled_missions: list[MissionConfig] = []
    selected_start: dict[str, int] = {}
    for mission in missions:
        chosen = next(
            (start for mid, start in candidate_pairs if mid == mission.id and pyo.value(model.x[mid, start]) > 0.5),
            None,
        )
        if chosen is None:
            if rejected_by_weather[mission.id] and not any(
                mid == mission.id for mid, _start in candidate_pairs
            ):
                if deadline_rejections.get(mission.id, 0):
                    reason = "No candidate start meets this mission's deadline and weather limits."
                else:
                    reason = "No candidate start meets this mission's weather limits."
            elif not options[mission.id]:
                reason = "No candidate start hours were supplied."
            else:
                reason = "Not selected by the priority/resource-feasibility objective."
            schedule.append({"mission_id": mission.id, "selected": False, "reason": reason})
            continue
        selected_start[mission.id] = chosen
        scheduled_missions.append(replace(mission, start_hour=chosen))
        schedule.append({
            "mission_id": mission.id,
            "selected": True,
            "start_hour": chosen,
            "duration_hours": mission.duration_hours,
            "priority": mission.priority.name.lower(),
            "priority_score": values[mission.id],
        })

    dispatch: list[dict[str, Any]] = []
    modeled_generator_fuel = 0.0
    modeled_start_fuel = 0.0
    modeled_mission_fuel = sum(
        mission_by_id[mid].non_electric_fuel_l for mid in selected_start
    )
    for hour in range(hours):
        generator_outputs = {
            generator.id: round(pyo.value(model.generator_kw[generator.id, hour]), 4)
            for generator in generators
        }
        generator_fuel = sum(
            generator_outputs[generator.id] * generator.liters_per_kwh
            for generator in generators
        )
        generator_states = {
            generator.id: bool(pyo.value(model.generator_on[generator.id, hour]) > 0.5)
            for generator in generators
        }
        generator_starts = {
            generator.id: bool(pyo.value(model.generator_start[generator.id, hour]) > 0.5)
            for generator in generators
        }
        startup_fuel = sum(
            generator.start_fuel_liters * generator_starts[generator.id]
            for generator in generators
        )
        generator_fuel += startup_fuel
        modeled_start_fuel += startup_fuel
        modeled_generator_fuel += generator_fuel
        scheduled_power = sum(
            mission.power_kw for mission in scheduled_missions
            if mission.start_hour <= hour < mission.start_hour + mission.duration_hours
        )
        dispatch.append({
            "hour": hour,
            "baseline_demand_kw": round(modeled_baseline_demand[hour], 4),
            "mission_demand_kw": round(scheduled_power, 4),
            "demand_kw": round(modeled_baseline_demand[hour] + scheduled_power, 4),
            "curtailed_kw": round(pyo.value(model.curtailed_kw[hour]), 4),
            "weather_regime": rows[hour].get("weather_regime"),
            "temperature_c": rows[hour].get("temperature_c"),
            "wind_kmh": rows[hour].get("wind_kmh"),
            "visibility_km": rows[hour].get("visibility_km"),
            "renewable_available_kw": round(rows[hour]["renewable_kw"], 4),
            "renewable_used_kw": round(pyo.value(model.renewable_used_kw[hour]), 4),
            "generator_output_kw": generator_outputs,
            "generator_on": generator_states,
            "generator_started": generator_starts,
            "generator_start_fuel_liters": round(startup_fuel, 4),
            "resupply_received_liters": round(pyo.value(model.resupply_delivery_liters[hour]), 4),
            "battery_charge_kw": round(pyo.value(model.charge_kw[hour]), 4),
            "battery_discharge_kw": round(pyo.value(model.discharge_kw[hour]), 4),
            "battery_soc_kwh": round(pyo.value(model.soc_kwh[hour + 1]), 4),
            "fuel_liters": round(pyo.value(model.fuel_liters[hour + 1]), 4),
        })

    replay_config = replace(config, station=replace(station, missions=tuple(scheduled_missions)))
    replay = engine.run(replay_config, weather_forcing=replay_weather)
    return {
        "status": "optimal" if final_status == TerminationCondition.optimal else "feasible",
        "solver": "HiGHS",
        "solver_solve_seconds": round(solver_solve_seconds, 6),
        "model": (
            "single-trajectory hourly MILP prototype"
            if weather_scenarios is None
            else "conservative-envelope hourly MILP prototype"
        ),
        "data_classification": "synthetic inputs unless caller supplies another explicitly labeled trajectory",
        "seed": config.seed,
        "duration_hours": hours,
        "assumptions": [
            "Mission value is a priority-only heuristic unless explicit positive mission_values are supplied.",
            "All station baseline load and every selected mission load must be served; no load shedding is modeled.",
            "Generator commitment transitions include start fuel, ramp limits, and minimum up/down times; start-up and shutdown occur within the modeled hourly step.",
            "Battery state at the end of the horizon must meet the terminal target (default: opening state of charge).",
            "Resupply-delay events shift delivery if they occur before the current predicted arrival, matching simulator event order.",
            "When scenarios are supplied, one common schedule is planned against per-hour worst-case renewable, temperature, visibility, and wind values; this is not a probability model or multistage recourse.",
            "The simulator replay uses its existing dispatch policy; the MILP dispatch is a proposal and is reported separately.",
        ],
        "planning_rules": {
            "latest_finish_hours": dict(latest_finish_hours or {}),
            "precedence": [list(rule) for rule in precedence],
            "terminal_soc_target_kwh": round(terminal_soc_target, 4),
            "terminal_soc_policy": "caller_supplied" if terminal_soc_kwh is not None else "opening_state_of_charge",
            "resupply": {
                "scheduled_arrival_hour": resupply.arrival_hour if resupply else None,
                "effective_arrival_hour": effective_resupply_hour,
                "delay_event_ids_applied": applied_resupply_delays,
            },
        },
        "uncertainty_assessment": uncertainty_assessment,
        "objective": {
            "priority_weighted_missions": round(optimum_score, 4),
            "modeled_generator_fuel_liters": round(modeled_generator_fuel, 4),
            "modeled_start_fuel_liters": round(modeled_start_fuel, 4),
            "modeled_mission_fuel_liters": round(modeled_mission_fuel, 4),
            "modeled_total_fuel_liters": round(modeled_generator_fuel + modeled_mission_fuel, 4),
            "modeled_renewable_curtailed_kwh": round(
                sum(pyo.value(model.curtailed_kw[hour]) for hour in range(hours)), 4
            ),
        },
        "schedule": schedule,
        "dispatch": dispatch,
        "simulator_replay": {
            "summary": replay.summary,
            "mission_results": replay.mission_results,
        },
    }
