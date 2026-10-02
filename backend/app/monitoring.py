"""Simulation-clock monitoring, trigger policy, and checkpoint-based replanning."""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timedelta
import math
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.models import (
    MonitoringEvent,
    MonitoringSession,
    PlanEvent,
    PlanVersion,
    SimulationRun,
    SimulationTelemetry,
)
from backend.app.plans import PLANNER_MODEL_VERSION, PlanRuleError, _explanations, _solver_version
from backend.simulation import EventKind, MissionConfig, SimulationConfig
from backend.simulation.scenarios import build_scenario


SOFT_HYSTERESIS_HOURS = 2
STARTUP_FREEZE_HOURS = 1
REPLAN_COOLDOWN_HOURS = 6
MINIMUM_FUEL_BENEFIT = 0.05


def _event_hour(run: SimulationRun, event: dict[str, Any]) -> int | None:
    try:
        timestamp = datetime.fromisoformat(event["timestamp"])
    except (KeyError, TypeError, ValueError):
        return None
    start = run.started_at
    if start.tzinfo is None and timestamp.tzinfo is not None:
        start = start.replace(tzinfo=timestamp.tzinfo)
    delta = (timestamp - start).total_seconds() / 3600
    return int(round(delta))


def start_monitoring_session(
    db: Session, *, plan_version_id: UUID, simulation_run_id: UUID
) -> MonitoringSession:
    plan = db.get(PlanVersion, plan_version_id)
    run = db.get(SimulationRun, simulation_run_id)
    if plan is None or run is None:
        raise PlanRuleError("The requested active plan or simulation run does not exist")
    if plan.status != "active":
        raise PlanRuleError("Monitoring can only start from an active plan")
    if plan.station_name != run.station_name or plan.scenario != run.scenario:
        raise PlanRuleError("The simulation run must match the active plan's station and scenario")
    if plan.days != run.duration_days or plan.seed != run.seed:
        raise PlanRuleError("The simulation run must match the active plan's duration and seed")
    if plan.simulation_start_time != run.config_snapshot.get("start_time"):
        raise PlanRuleError("The simulation run must match the active plan's start time")
    if plan.source_simulation_run_id not in (None, run.id):
        raise PlanRuleError("The active plan is linked to a different simulation run")
    telemetry_count = db.scalar(
        select(func.count()).select_from(SimulationTelemetry).where(
            SimulationTelemetry.run_id == run.id
        )
    ) or 0
    if telemetry_count != run.duration_days * 24:
        raise PlanRuleError("Monitoring requires a complete hourly simulation run")
    session = MonitoringSession(
        station_name=plan.station_name,
        plan_version_id=plan.id,
        simulation_run_id=run.id,
        current_hour=-1,
        status="monitoring",
        alert_state={},
    )
    db.add(session)
    db.flush()
    return session


def _hour_observation(
    session: MonitoringSession,
    run: SimulationRun,
    plan: PlanVersion,
    telemetry: list[dict[str, Any]],
    hour: int,
) -> dict[str, Any]:
    actual = telemetry[hour]
    dispatch_rows = plan.plan_snapshot.get("dispatch", [])
    planned = dispatch_rows[hour] if hour < len(dispatch_rows) else {}
    run_events = [
        item for item in run.event_log if _event_hour(run, item) == hour
    ]
    mission_events = [
        {"kind": item.get("kind"), "mission_id": item.get("subject"), "message": item.get("message")}
        for item in run_events
        if str(item.get("kind", "")).startswith("mission_")
    ]
    mission_progress = []
    for scheduled in plan.plan_snapshot.get("schedule", []):
        mission_id = str(scheduled.get("mission_id"))
        if not scheduled.get("selected"):
            planned_state = "not_in_active_schedule"
        else:
            start = int(scheduled["start_hour"])
            end = start + int(scheduled["duration_hours"])
            planned_state = (
                "upcoming" if hour < start
                else "in_progress" if hour < end
                else "planned_window_elapsed"
            )
        prior_mission_events = [
            item for item in run.event_log
            if str(item.get("subject")) == mission_id
            and str(item.get("kind", "")).startswith("mission_")
            and (_event_hour(run, item) is not None and _event_hour(run, item) <= hour)
        ]
        latest_event = prior_mission_events[-1] if prior_mission_events else None
        mission_progress.append({
            "mission_id": mission_id,
            "planned_state": planned_state,
            "observed_state": latest_event.get("kind") if latest_event else "no_event_yet",
            "last_observed_event_hour": _event_hour(run, latest_event) if latest_event else None,
        })
    return {
        "hour": hour,
        "timestamp": actual.get("timestamp"),
        "weather": {
            "regime": actual.get("weather_regime"),
            "temperature_c": actual.get("temperature_c"),
            "wind_kmh": actual.get("wind_kmh"),
            "visibility_km": actual.get("visibility_km"),
            "forecast_regime": planned.get("weather_regime"),
            "forecast_temperature_c": planned.get("temperature_c"),
            "forecast_wind_kmh": planned.get("wind_kmh"),
            "forecast_visibility_km": planned.get("visibility_km"),
        },
        "renewable_kw": actual.get("renewable_kw"),
        "demand_kw": actual.get("demand_kw"),
        "served_kw": actual.get("served_kw"),
        "critical_violation": actual.get("critical_violation", False),
        "battery_kwh": actual.get("battery_kwh"),
        "fuel_liters": actual.get("fuel_liters"),
        "fuel_runway_hours": actual.get("fuel_runway_hours"),
        "generator_status": actual.get("generator_status", {}),
        "mission_events": mission_events,
        "mission_progress": mission_progress,
        "forecast_comparison": {
            "planned_renewable_available_kw": planned.get("renewable_available_kw"),
            "renewable_delta_kw": round(
                float(actual.get("renewable_kw", 0))
                - float(planned.get("renewable_available_kw", 0)), 4
            ),
            "planned_battery_kwh": planned.get("battery_soc_kwh"),
            "battery_delta_kwh": round(
                float(actual.get("battery_kwh", 0))
                - float(planned.get("battery_soc_kwh", 0)), 4
            ),
            "planned_fuel_liters": planned.get("fuel_liters"),
            "fuel_delta_liters": round(
                float(actual.get("fuel_liters", 0))
                - float(planned.get("fuel_liters", 0)), 4
            ),
        },
        "simulation_events": [
            {"kind": item.get("kind"), "subject": item.get("subject"), "message": item.get("message")}
            for item in run_events
        ],
    }


def _signals(
    plan: PlanVersion,
    run: SimulationRun,
    telemetry: list[dict[str, Any]],
    hour: int,
) -> list[dict[str, Any]]:
    actual = telemetry[hour]
    event_rows = [item for item in run.event_log if _event_hour(run, item) == hour]
    signals: list[dict[str, Any]] = []
    event_rules = (
        ("generator_failure", "critical", "generator_failure"),
        ("storm", "high", "storm"),
        ("resupply_delay", "high", "resupply_delay"),
        ("mission_power_shortfall", "critical", "mission_power_shortfall"),
        ("mission_failed", "high", "mission_failed"),
        ("mission_weather_interruption", "high", "mission_weather_interruption"),
        ("mission_deferred", "medium", "mission_deferred"),
    )
    for kind, severity, rule in event_rules:
        matching = [item for item in event_rows if item.get("kind") == kind]
        if matching:
            signals.append({
                "rule": rule, "severity": severity, "source": matching, "event_based": True
            })
    if actual.get("critical_violation"):
        signals.append({"rule": "critical_load_violation", "severity": "critical", "source": []})

    previous = telemetry[max(0, hour - 1):hour + 1]
    base = build_scenario(run.scenario, days=run.duration_days, seed=run.seed).station
    installed_renewable = base.solar_capacity_kw + base.wind_capacity_kw
    renewable_floor = max(8.0, installed_renewable * 0.18)
    def renewable_stress(row: dict[str, Any]) -> bool:
        regime = str(row.get("weather_regime", ""))
        genuinely_low_capacity = installed_renewable <= 5.0
        poor_weather = regime in {"cloudy", "storm"}
        return (genuinely_low_capacity or poor_weather) and float(row.get("renewable_kw", 0)) < renewable_floor

    if len(previous) == SOFT_HYSTERESIS_HOURS and all(renewable_stress(row) for row in previous):
        signals.append({
            "rule": "low_renewable_output", "severity": "high",
            "source": [{"threshold_kw": round(renewable_floor, 3)}],
            "condition_window_hours": SOFT_HYSTERESIS_HOURS,
        })
    if len(previous) == SOFT_HYSTERESIS_HOURS:
        plan_dispatch = plan.plan_snapshot.get("dispatch", [])
        deviations = []
        for index, row in zip(range(hour - 1, hour + 1), previous, strict=True):
            expected = plan_dispatch[index] if index < len(plan_dispatch) else {}
            deviations.append(
                float(row.get("battery_kwh", 0))
                < float(expected.get("battery_soc_kwh", 0)) - 60.0
            )
        if all(deviations):
            signals.append({
                "rule": "battery_plan_deviation", "severity": "medium", "source": [],
                "condition_window_hours": SOFT_HYSTERESIS_HOURS,
            })
        runway = actual.get("fuel_runway_hours")
        if runway is not None and float(runway) < 72.0:
            signals.append({"rule": "low_fuel_runway", "severity": "medium", "source": []})
    return signals


def _update_hysteresis(
    session: MonitoringSession, signals: list[dict[str, Any]], hour: int
) -> list[dict[str, Any]]:
    by_rule = {item["rule"]: item for item in signals}
    state = {key: dict(value) for key, value in (session.alert_state or {}).items()}
    matured: list[dict[str, Any]] = []
    known_rules = set(state) | set(by_rule)
    for rule in known_rules:
        current = by_rule.get(rule)
        item = state.get(rule, {"active": False, "count": 0, "clear": 0})
        if current:
            item["count"] = int(item.get("count", 0)) + 1
            item["clear"] = 0
            threshold = (
                1
                if (
                    current.get("event_based")
                    or current.get("condition_window_hours", 1) >= SOFT_HYSTERESIS_HOURS
                    or current["severity"] in {"critical", "high"}
                )
                else SOFT_HYSTERESIS_HOURS
            )
            if not item.get("active") and item["count"] >= threshold:
                item["active"] = True
                matured.append(current)
        else:
            item["count"] = 0
            if item.get("active"):
                item["clear"] = int(item.get("clear", 0)) + 1
                if item["clear"] >= SOFT_HYSTERESIS_HOURS:
                    item = {"active": False, "count": 0, "clear": 0}
        state[rule] = item
    session.alert_state = state
    return matured


def _checkpoint_config(
    parent: PlanVersion,
    run: SimulationRun,
    telemetry: list[dict[str, Any]],
    hour: int,
) -> tuple[SimulationConfig, dict[str, list[int]]]:
    from backend.simulation import BatteryConfig, GeneratorConfig, ResupplyConfig, ScheduledEvent

    next_hour = hour + 1
    remaining_hours = run.duration_days * 24 - next_hour
    if remaining_hours <= 0:
        raise PlanRuleError("The simulated run has no remaining hours to replan")
    remaining_days = math.ceil(remaining_hours / 24)
    original = build_scenario(parent.scenario, days=run.duration_days, seed=run.seed)
    current = telemetry[hour]
    planned = {
        item["mission_id"]: item
        for item in parent.plan_snapshot.get("schedule", []) if item.get("selected")
    }
    original_missions = {mission.id: mission for mission in original.station.missions}

    mission_events: dict[str, list[tuple[int, str]]] = {}
    for item in run.event_log:
        if str(item.get("kind", "")).startswith("mission_"):
            event_hour = _event_hour(run, item)
            if event_hour is not None and event_hour <= hour:
                mission_events.setdefault(str(item.get("subject")), []).append(
                    (event_hour, str(item.get("kind")))
                )
    missions: list[MissionConfig] = []
    baseline_starts: dict[str, list[int]] = {}
    for mission_id, schedule in planned.items():
        mission = original_missions.get(mission_id)
        if mission is None:
            continue
        planned_start = int(schedule["start_hour"])
        planned_end = planned_start + int(schedule["duration_hours"])
        outcomes = mission_events.get(mission_id, [])
        completed = any(kind == "mission_completed" for _event_hour_value, kind in outcomes)
        failed = any(
            kind in {"mission_failed", "mission_deferred", "mission_weather_interruption", "mission_power_shortfall"}
            for _event_hour_value, kind in outcomes
        )
        if completed and not failed:
            continue
        if planned_end <= next_hour and not failed:
            continue
        if failed:
            remaining_duration = mission.duration_hours
            shifted_start = 0
            mission_fuel = mission.non_electric_fuel_l
        else:
            remaining_duration = max(1, planned_end - next_hour)
            shifted_start = max(0, planned_start - next_hour)
            mission_fuel = 0.0 if planned_start < next_hour else mission.non_electric_fuel_l
        if shifted_start + remaining_duration > remaining_hours:
            continue
        missions.append(replace(
            mission,
            start_hour=shifted_start,
            duration_hours=remaining_duration,
            non_electric_fuel_l=mission_fuel,
        ))
        baseline_starts[mission_id] = [shifted_start]

    battery = original.station.battery
    current_soc = max(0.0, min(battery.capacity_kwh, float(current["battery_kwh"])))
    battery = replace(
        battery,
        initial_kwh=current_soc,
        reserve_kwh=min(battery.reserve_kwh, current_soc),
    )
    generators: list[GeneratorConfig] = []
    for generator in original.station.generators:
        output = float(current.get("generator_output_kw", {}).get(generator.id, 0.0))
        is_on = output > 1e-6
        generators.append(replace(
            generator,
            initial_on=is_on,
            initial_power_kw=output if is_on else 0.0,
            initial_state_hours=1,
        ))

    resupply = original.station.fuel_resupply
    arrival = current.get("resupply_arrival_hour")
    if resupply is not None and arrival is not None and int(arrival) > hour:
        resupply = replace(resupply, arrival_hour=max(0, int(arrival) - next_hour))
    else:
        resupply = None

    events: list[ScheduledEvent] = []
    for event in original.events:
        if event.kind is EventKind.RESUPPLY_DELAY:
            continue  # The checkpoint telemetry already contains its effective arrival hour.
        event_end = event.hour + event.duration_hours
        if event_end <= next_hour:
            continue
        shifted_start = max(0, event.hour - next_hour)
        shifted_duration = event_end - max(event.hour, next_hour)
        events.append(replace(event, hour=shifted_start, duration_hours=shifted_duration))

    station = replace(
        original.station,
        battery=battery,
        generators=tuple(generators),
        initial_fuel_liters=max(0.0, min(original.station.fuel_capacity_liters, float(current["fuel_liters"]))),
        fuel_resupply=resupply,
        missions=tuple(missions),
    )
    timestamp = datetime.fromisoformat(str(current["timestamp"])) + timedelta(hours=1)
    seed = (abs(run.seed) + 104729 * next_hour) % (2**63 - 1)
    config = SimulationConfig(
        days=remaining_days,
        seed=seed,
        start_time=timestamp.isoformat(),
        station=station,
        events=tuple(events),
    )
    config.validate()
    return config, baseline_starts


def _create_checkpoint_proposal(
    db: Session,
    session: MonitoringSession,
    plan: PlanVersion,
    run: SimulationRun,
    telemetry: list[dict[str, Any]],
    hour: int,
    trigger: dict[str, Any],
) -> tuple[PlanVersion | None, dict[str, Any]]:
    from backend.optimization import optimize_schedule

    config, baseline_starts = _checkpoint_config(plan, run, telemetry, hour)
    candidate = optimize_schedule(config, flexibility_hours=min(plan.flexibility_hours, 12))
    baseline = optimize_schedule(config, start_options=baseline_starts, flexibility_hours=0)
    if candidate["status"] not in {"optimal", "feasible"}:
        return None, {"reason": candidate.get("reason", candidate["status"]), "minimum_benefit_met": False}
    candidate_score = float(candidate.get("objective", {}).get("priority_weighted_missions", 0))
    baseline_score = float(baseline.get("objective", {}).get("priority_weighted_missions", 0))
    candidate_fuel = float(candidate.get("objective", {}).get("modeled_total_fuel_liters", 0))
    baseline_fuel = float(baseline.get("objective", {}).get("modeled_total_fuel_liters", 0))
    score_gain = candidate_score - baseline_score
    fuel_reduction = (
        (baseline_fuel - candidate_fuel) / baseline_fuel if baseline_fuel > 1e-9 else 0.0
    )
    bypass = trigger["severity"] in {"critical", "high"}
    benefit_met = (
        score_gain >= 1.0
        or fuel_reduction >= MINIMUM_FUEL_BENEFIT
        or baseline["status"] == "infeasible"
        or bypass
    )
    benefit = {
        "candidate_priority_score": round(candidate_score, 4),
        "carry_forward_priority_score": round(baseline_score, 4),
        "priority_score_gain": round(score_gain, 4),
        "candidate_modeled_fuel_liters": round(candidate_fuel, 3),
        "carry_forward_modeled_fuel_liters": round(baseline_fuel, 3),
        "modeled_fuel_reduction_fraction": round(fuel_reduction, 4),
        "minimum_fuel_reduction_fraction": MINIMUM_FUEL_BENEFIT,
        "safety_trigger_bypass": bypass,
        "minimum_benefit_met": benefit_met,
    }
    if not benefit_met:
        return None, benefit

    latest_version = db.scalar(
        select(PlanVersion.version_number)
        .where(PlanVersion.plan_group_id == plan.plan_group_id)
        .order_by(PlanVersion.version_number.desc())
        .limit(1)
    ) or plan.version_number
    candidate["monitoring_replan"] = {
        "session_id": str(session.id),
        "source_simulation_run_id": str(run.id),
        "checkpoint_hour": hour,
        "trigger": trigger["rule"],
        "starting_state": {
            "battery_kwh": telemetry[hour].get("battery_kwh"),
            "fuel_liters": telemetry[hour].get("fuel_liters"),
            "generator_status": telemetry[hour].get("generator_status", {}),
        },
        "forecast_policy": "new deterministic synthetic trajectory from the observed checkpoint; not future observed weather",
        "benefit_assessment": benefit,
    }
    explanations = _explanations(config, candidate)
    explanations["monitoring_replan"] = candidate["monitoring_replan"]
    replan = PlanVersion(
        plan_group_id=plan.plan_group_id,
        version_number=latest_version + 1,
        parent_version_id=plan.id,
        source_simulation_run_id=run.id,
        station_name=plan.station_name,
        scenario=plan.scenario,
        days=config.days,
        seed=config.seed,
        flexibility_hours=min(plan.flexibility_hours, 12),
        simulation_start_time=config.start_time,
        solver_name=candidate.get("solver", "unknown"),
        solver_version=_solver_version(candidate.get("solver", "unknown")),
        planner_model_version=PLANNER_MODEL_VERSION,
        status="proposed",
        plan_snapshot=candidate,
        explanations=explanations,
    )
    db.add(replan)
    db.flush()
    db.add(PlanEvent(
        plan_version_id=replan.id,
        action="monitoring_replan_created",
        from_status=None,
        to_status="proposed",
        actor="monitor",
        note=f"Proposed in response to {trigger['rule']}; active version remains unchanged pending approval.",
        details={
            "monitoring_session_id": str(session.id),
            "source_simulation_run_id": str(run.id),
            "checkpoint_hour": hour,
            "trigger": trigger["rule"],
            "benefit_assessment": benefit,
        },
    ))
    return replan, benefit


def advance_monitoring_session(
    db: Session, session: MonitoringSession, *, hours: int
) -> MonitoringSession:
    if session.status != "monitoring":
        raise PlanRuleError("This monitoring session is already complete")
    plan = db.get(PlanVersion, session.plan_version_id)
    run = db.get(SimulationRun, session.simulation_run_id)
    if plan is None or run is None:
        raise PlanRuleError("Monitoring session references missing plan or simulation data")
    if plan.status != "active":
        raise PlanRuleError("The monitored plan is no longer active; start a session for the approved replacement")
    rows = db.scalars(
        select(SimulationTelemetry)
        .where(SimulationTelemetry.run_id == run.id)
        .order_by(SimulationTelemetry.hour)
    ).all()
    telemetry = [item.payload for item in rows]
    for _ in range(hours):
        next_hour = session.current_hour + 1
        if next_hour >= len(telemetry):
            session.status = "completed"
            break
        session.current_hour = next_hour
        observed = _hour_observation(session, run, plan, telemetry, next_hour)
        triggers = _update_hysteresis(
            session, _signals(plan, run, telemetry, next_hour), next_hour
        )
        for trigger in triggers:
            action = "alert_recorded"
            proposal_id = None
            details = {"observation": observed}
            pending = db.get(PlanVersion, session.pending_proposal_id) if session.pending_proposal_id else None
            if pending and pending.status in {"proposed", "reviewed", "approved"}:
                action = "suppressed_pending_proposal"
            else:
                session.pending_proposal_id = None
                severe = trigger["severity"] in {"critical", "high"}
                if not severe and next_hour < STARTUP_FREEZE_HOURS:
                    action = "suppressed_freeze_window"
                elif (
                    not severe
                    and session.last_proposal_hour is not None
                    and next_hour - session.last_proposal_hour < REPLAN_COOLDOWN_HOURS
                ):
                    action = "suppressed_replan_cooldown"
                else:
                    try:
                        proposal, benefit = _create_checkpoint_proposal(
                            db, session, plan, run, telemetry, next_hour, trigger
                        )
                    except (PlanRuleError, ValueError, RuntimeError) as exc:
                        proposal, benefit = None, {"reason": str(exc), "minimum_benefit_met": False}
                    details["benefit_assessment"] = benefit
                    if proposal is None:
                        action = "suppressed_minimum_benefit"
                    else:
                        action = "proposal_created"
                        proposal_id = proposal.id
                        session.pending_proposal_id = proposal.id
                        session.last_proposal_hour = next_hour
            db.add(MonitoringEvent(
                session_id=session.id,
                hour=next_hour,
                rule=trigger["rule"],
                severity=trigger["severity"],
                action=action,
                observation=details,
                proposal_plan_version_id=proposal_id,
            ))
    if session.current_hour >= len(telemetry) - 1:
        session.status = "completed"
    db.flush()
    return session


def serialize_monitoring_session(db: Session, session: MonitoringSession) -> dict[str, Any]:
    events = db.scalars(
        select(MonitoringEvent)
        .where(MonitoringEvent.session_id == session.id)
        .order_by(MonitoringEvent.hour, MonitoringEvent.created_at)
    ).all()
    latest = None
    if session.current_hour >= 0:
        row = db.get(SimulationTelemetry, (session.simulation_run_id, session.current_hour))
        if row is not None:
            run = db.get(SimulationRun, session.simulation_run_id)
            plan = db.get(PlanVersion, session.plan_version_id)
            if run and plan:
                all_rows = db.scalars(
                    select(SimulationTelemetry)
                    .where(SimulationTelemetry.run_id == run.id)
                    .order_by(SimulationTelemetry.hour)
                ).all()
                latest = _hour_observation(
                    session, run, plan, [item.payload for item in all_rows], session.current_hour
                )
    return {
        "id": session.id,
        "station_name": session.station_name,
        "plan_version_id": session.plan_version_id,
        "simulation_run_id": session.simulation_run_id,
        "current_hour": session.current_hour,
        "status": session.status,
        "last_proposal_hour": session.last_proposal_hour,
        "pending_proposal_id": session.pending_proposal_id,
        "latest_observation": latest,
        "events": [
            {
                "id": item.id,
                "hour": item.hour,
                "rule": item.rule,
                "severity": item.severity,
                "action": item.action,
                "observation": item.observation,
                "proposal_plan_version_id": item.proposal_plan_version_id,
                "created_at": item.created_at,
            }
            for item in events
        ],
        "created_at": session.created_at,
        "updated_at": session.updated_at,
    }
