"""Plan proposal, immutable-version, comparison, and approval domain services."""

from __future__ import annotations

from importlib.metadata import PackageNotFoundError, version
from typing import Any
from dataclasses import asdict
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models import PlanEvent, PlanVersion, SimulationRun
from backend.simulation import SimulationConfig
from backend.simulation.scenarios import build_scenario
from backend.app.case_config import restore_config, fingerprint
from backend.simulation.forecast_scenarios import build_trajectory

PLANNER_MODEL_VERSION = "firn-joint-mission-energy-milp-v1"


def _solver_version(solver_name: str) -> str:
    package = "highspy" if solver_name.casefold() == "highs" else solver_name.casefold()
    try:
        return version(package)
    except PackageNotFoundError:
        return "unknown"


class PlanRuleError(ValueError):
    """A plan lifecycle or edit request violates the domain rules."""


class PlanningFailure(PlanRuleError):
    def __init__(self, snapshot: dict[str, Any]):
        super().__init__(f"Optimizer did not produce a plan: {snapshot.get('reason', snapshot['status'])}")
        self.result = {"code": snapshot["status"], "message": str(self),
                       "diagnostics": snapshot.get("diagnostics", {}),
                       "uncertainty_assessment": snapshot.get("uncertainty_assessment", {})}


def planning_weather(config: SimulationConfig, mode: str) -> dict[str, Any]:
    if mode == "saved":
        return {}
    if mode in {"nominal", "adverse"}:
        return {"weather_forcing": build_trajectory("nominal" if mode == "nominal" else "low_renewable", config.hours).weather}
    if mode == "robust":
        return {"weather_scenarios": {name: build_trajectory(name, config.hours).weather
                                     for name in ("nominal", "low_renewable", "storm")}}
    raise ValueError("Unknown planning mode")


def _build_config(
    *, scenario: str, days: int, seed: int, start_time: str
) -> SimulationConfig:
    config = build_scenario(scenario, days=days, seed=seed)
    return SimulationConfig(
        days=config.days,
        seed=config.seed,
        start_time=start_time,
        station=config.station,
        events=config.events,
    )


def _explanations(config: SimulationConfig, snapshot: dict[str, Any]) -> dict[str, Any]:
    schedule = snapshot.get("schedule", [])
    mission_by_id = {mission.id: mission for mission in config.station.missions}
    decisions = []
    for item in schedule:
        mission = mission_by_id.get(item["mission_id"])
        if item.get("selected"):
            original = mission.start_hour if mission else None
            start = item.get("start_hour")
            decisions.append({
                "mission_id": item["mission_id"],
                "decision": "scheduled" if start == original else "rescheduled",
                "original_start_hour": original,
                "proposed_start_hour": start,
                "reason": "Chosen by the priority-weighted mission objective, subject to the modeled hard constraints; fuel is minimized after mission score is fixed.",
            })
        else:
            decisions.append({
                "mission_id": item["mission_id"],
                "decision": "not_scheduled",
                "reason": item.get("reason", "Not selected by the optimization model."),
            })

    constraints: dict[str, dict[str, Any]] = {}
    generators = {generator.id: generator for generator in config.station.generators}
    battery = config.station.battery
    for row in snapshot.get("dispatch", []):
        hour = row.get("hour")
        for generator_id, output in row.get("generator_output_kw", {}).items():
            generator = generators.get(generator_id)
            if generator and output >= generator.capacity_kw - 1e-3:
                constraints.setdefault("generator_capacity", {
                    "constraint": "generator_capacity",
                    "evidence_hours": [],
                    "explanation": "At least one generator is at its configured output limit.",
                })["evidence_hours"].append(hour)
        if row.get("battery_soc_kwh", battery.capacity_kwh) <= battery.reserve_kwh + 1e-3:
            constraints.setdefault("battery_reserve", {
                "constraint": "battery_reserve",
                "evidence_hours": [],
                "explanation": "Battery state of charge reaches the protected reserve boundary.",
            })["evidence_hours"].append(hour)
        for key, limit, label in (
            ("battery_charge_kw", battery.max_charge_kw, "battery_charge_power"),
            ("battery_discharge_kw", battery.max_discharge_kw, "battery_discharge_power"),
        ):
            if limit > 0 and row.get(key, 0.0) >= limit - 1e-3:
                constraints.setdefault(label, {
                    "constraint": label,
                    "evidence_hours": [],
                    "explanation": f"Battery {key.split('_')[1]} reaches its configured power limit.",
                })["evidence_hours"].append(hour)

    replay_summary = snapshot.get("simulator_replay", {}).get("summary", {})
    return {
        "mission_decisions": decisions,
        "binding_constraint_evidence": list(constraints.values()),
        "replay_impact": {
            key: replay_summary.get(key)
            for key in (
                "missions_completed", "missions_deferred", "missions_failed",
                "total_fuel_consumed_liters", "unserved_energy_kwh",
                "critical_violation_hours", "battery_min_kwh", "fuel_remaining_liters",
            )
        },
        "interpretation_limit": "Constraint evidence is inferred from values at modeled limits; it is not an IIS, causal proof, or operational recommendation.",
    }


def _add_event(
    db: Session,
    plan: PlanVersion,
    *, action: str, from_status: str | None, to_status: str | None,
    actor: str, note: str | None = None, details: dict[str, Any] | None = None,
) -> None:
    db.add(PlanEvent(
        plan_version=plan,
        action=action,
        from_status=from_status,
        to_status=to_status,
        actor=actor,
        note=note,
        details=details or {},
    ))


def create_proposal(
    db: Session,
    *, scenario: str, days: int, seed: int, flexibility_hours: int,
    start_time: str, source_run: SimulationRun | None = None,
    planning_mode: str = "saved", request_id: str | None = None,
) -> PlanVersion:
    from backend.optimization import optimize_schedule

    config = restore_config(source_run.config_snapshot) if source_run else _build_config(scenario=scenario, days=days, seed=seed, start_time=start_time)
    snapshot = optimize_schedule(config, flexibility_hours=flexibility_hours, **planning_weather(config, planning_mode))
    if snapshot["status"] not in {"optimal", "feasible"}:
        raise PlanningFailure(snapshot)
    snapshot["planning_context"] = {"mode": planning_mode, "request_id": request_id,
        "config_fingerprint": fingerprint(config), "config_snapshot": asdict(config),
        "flexibility_hours": flexibility_hours}
    group_id = uuid4()
    plan = PlanVersion(
        plan_group_id=group_id,
        version_number=1,
        parent_version_id=None,
        source_simulation_run_id=source_run.id if source_run else None,
        station_name=config.station.name,
        scenario=scenario,
        days=days,
        seed=seed,
        flexibility_hours=flexibility_hours,
        simulation_start_time=start_time,
        solver_name=snapshot.get("solver", "unknown"),
        solver_version=_solver_version(snapshot.get("solver", "unknown")),
        planner_model_version=PLANNER_MODEL_VERSION,
        status="proposed",
        plan_snapshot=snapshot,
        explanations=_explanations(config, snapshot),
    )
    db.add(plan)
    db.flush()
    _add_event(db, plan, action="proposal_created", from_status=None, to_status="proposed", actor="system")
    return plan


def _require_editable_lineage(db: Session, plan: PlanVersion) -> None:
    """Legacy edits can lose checkpoint metadata, so inspect every ancestor."""
    visited: set[UUID] = set()
    current = plan
    while True:
        if "monitoring_replan" in current.plan_snapshot:
            # The existing edit route maps PlanRuleError to 422. This unsupported
            # operation is a conflict, before any configuration rebuild or writes.
            raise HTTPException(
                status_code=409,
                detail="Timing edits are unsupported for checkpoint plans and their descendants; "
                "checkpoint configuration cannot be safely reconstructed for editing.",
            )
        if current.id in visited:
            raise HTTPException(status_code=409, detail="Cannot verify plan edit lineage: cycle detected")
        visited.add(current.id)
        if current.parent_version_id is None:
            return
        ancestor = db.get(PlanVersion, current.parent_version_id)
        if ancestor is None:
            raise HTTPException(status_code=409, detail="Cannot verify plan edit lineage: ancestor missing")
        current = ancestor


def create_edited_version(
    db: Session, parent: PlanVersion, mission_start_hours: dict[str, int], *, actor: str = "operator", request_id: str | None = None
) -> PlanVersion:
    from backend.optimization import optimize_schedule

    if request_id:
        existing = db.scalar(select(PlanVersion).where(
            PlanVersion.plan_snapshot["planning_context"]["edit_request_id"].as_string() == request_id))
        if existing:
            previous = existing.plan_snapshot["planning_context"]
            if existing.parent_version_id != parent.id or previous.get("edit_starts") != mission_start_hours or previous.get("edit_actor") != actor:
                raise HTTPException(status_code=409, detail="This request ID already belongs to a different timing edit")
            return existing
    _require_editable_lineage(db, parent)
    context = parent.plan_snapshot.get("planning_context", {})
    source = db.get(SimulationRun, parent.source_simulation_run_id) if parent.source_simulation_run_id else None
    saved_config = context.get("config_snapshot") or (source.config_snapshot if source else None)
    config = restore_config(saved_config) if saved_config else _build_config(
        scenario=parent.scenario,
        days=parent.days,
        seed=parent.seed,
        start_time=parent.simulation_start_time,
    )
    selected = {
        item["mission_id"]: item["start_hour"]
        for item in parent.plan_snapshot.get("schedule", [])
        if item.get("selected")
    }
    unknown = set(mission_start_hours) - set(selected)
    if unknown:
        raise PlanRuleError(f"Edits must target currently scheduled missions: {', '.join(sorted(unknown))}")
    if not mission_start_hours:
        raise PlanRuleError("At least one mission start-time edit is required")
    candidate_starts = {**selected, **mission_start_hours}
    if candidate_starts == selected:
        raise PlanRuleError("The edit does not change any mission start time")
    mission_ids = {mission.id for mission in config.station.missions}
    start_options = {
        mission_id: ([candidate_starts[mission_id]] if mission_id in candidate_starts else [])
        for mission_id in mission_ids
    }
    snapshot = optimize_schedule(config, start_options=start_options, flexibility_hours=0,
                                 **planning_weather(config, context.get("mode", "saved")))
    if snapshot["status"] not in {"optimal", "feasible"}:
        raise PlanningFailure(snapshot)
    actual = {
        item["mission_id"]: item["start_hour"]
        for item in snapshot.get("schedule", []) if item.get("selected")
    }
    if actual != candidate_starts:
        raise PlanningFailure({"status": "infeasible", "reason": "The requested timing edit cannot retain every selected mission",
            "diagnostics": {"missions_not_retained": sorted(set(candidate_starts) - set(actual)),
                            "requested_starts": candidate_starts,
                            "note": "A feasible optional-mission solve dropped work fixed by the operator. This edit is rejected, not saved; inspect mission weather, time and shared-resource restrictions."},
            "uncertainty_assessment": snapshot.get("uncertainty_assessment", {})})
    snapshot["planning_context"] = {**context, "config_snapshot": asdict(config), "config_fingerprint": fingerprint(config), "request_id": None,
                                   "edit_request_id": request_id, "edit_starts": mission_start_hours, "edit_actor": actor}

    latest = db.scalar(
        select(PlanVersion.version_number)
        .where(PlanVersion.plan_group_id == parent.plan_group_id)
        .order_by(PlanVersion.version_number.desc())
        .limit(1)
    ) or parent.version_number
    explanations = _explanations(config, snapshot)
    before_schedule = {
        item["mission_id"]: item for item in parent.plan_snapshot.get("schedule", [])
    }
    for item in snapshot.get("schedule", []):
        previous = before_schedule.get(item["mission_id"], {})
        if not previous.get("selected") and not item.get("selected"):
            item["reason"] = "Retained parent selection: " + previous.get("reason", "Not selected in the parent version.")
    after_schedule = {item["mission_id"]: item for item in snapshot.get("schedule", [])}
    explanations["mission_decisions"] = [
        {
            "mission_id": mission_id,
            "decision": (
                "operator_rescheduled"
                if old.get("selected") and new.get("selected") and old.get("start_hour") != new.get("start_hour")
                else "operator_retained"
                if old.get("selected") and new.get("selected")
                else "operator_selection_changed"
                if old.get("selected") != new.get("selected")
                else "unchanged"
            ),
            "before": {"selected": old.get("selected"), "start_hour": old.get("start_hour")},
            "after": {"selected": new.get("selected"), "start_hour": new.get("start_hour")},
            "reason": (
                "Operator-requested mission timing was validated against modeled weather, resource, and energy constraints."
                if old.get("start_hour") != new.get("start_hour")
                else "Mission timing was retained from the parent version and revalidated with the edited schedule."
            ),
        }
        for mission_id in sorted(set(before_schedule) | set(after_schedule))
        for old, new in [(before_schedule.get(mission_id, {}), after_schedule.get(mission_id, {}))]
    ]
    explanations["before_after_impact"] = {
        "objective": {
            key: {
                "before": parent.plan_snapshot.get("objective", {}).get(key),
                "after": snapshot.get("objective", {}).get(key),
            }
            for key in ("priority_weighted_missions", "modeled_total_fuel_liters", "modeled_renewable_curtailed_kwh")
        },
        "replay": {
            key: {
                "before": parent.explanations.get("replay_impact", {}).get(key),
                "after": explanations.get("replay_impact", {}).get(key),
            }
            for key in ("missions_completed", "total_fuel_consumed_liters", "unserved_energy_kwh", "critical_violation_hours")
        },
    }
    plan = PlanVersion(
        plan_group_id=parent.plan_group_id,
        version_number=latest + 1,
        parent_version_id=parent.id,
        source_simulation_run_id=parent.source_simulation_run_id,
        station_name=parent.station_name,
        scenario=parent.scenario,
        days=parent.days,
        seed=parent.seed,
        flexibility_hours=parent.flexibility_hours,
        simulation_start_time=parent.simulation_start_time,
        solver_name=snapshot.get("solver", "unknown"),
        solver_version=_solver_version(snapshot.get("solver", "unknown")),
        planner_model_version=PLANNER_MODEL_VERSION,
        status="proposed",
        plan_snapshot=snapshot,
        explanations=explanations,
    )
    db.add(plan)
    db.flush()
    _add_event(
        db, plan, action="operator_edit", from_status=None, to_status="proposed", actor=actor,
        details={"parent_version": parent.version_number, "mission_start_hours": mission_start_hours},
    )
    return plan


TRANSITIONS = {
    "review": {"proposed": "reviewed"},
    "approve": {"proposed": "approved", "reviewed": "approved"},
    "reject": {"proposed": "rejected", "reviewed": "rejected", "approved": "rejected"},
    "activate": {"approved": "active"},
}


def apply_plan_action(
    db: Session, plan: PlanVersion, *, action: str, actor: str, note: str | None
) -> PlanVersion:
    current = plan.status
    next_status = TRANSITIONS.get(action, {}).get(current)
    if next_status is None:
        raise PlanRuleError(f"Cannot {action} a plan in {current} state")
    if action == "activate":
        from backend.app.monitoring import activate_checkpoint_execution
        activate_checkpoint_execution(db, plan, actor=actor)
        active_plans = db.scalars(
            select(PlanVersion)
            .where(PlanVersion.station_name == plan.station_name, PlanVersion.status == "active")
            .with_for_update()
        ).all()
        for active in active_plans:
            if active.id == plan.id:
                continue
            active.status = "superseded"
            _add_event(
                db, active, action="superseded_by_new_plan", from_status="active",
                to_status="superseded", actor=actor, note=note,
                details={"replacement_plan_version_id": str(plan.id)},
            )
        # Free the partial unique index before attempting to activate its replacement.
        db.flush()
    plan.status = next_status
    _add_event(db, plan, action=action, from_status=current, to_status=next_status, actor=actor, note=note)
    return plan


def compare_versions(db: Session, group_id: UUID, baseline: int, candidate: int) -> dict[str, Any]:
    if baseline == candidate:
        raise PlanRuleError("Baseline and candidate must be different plan versions")
    versions = db.scalars(
        select(PlanVersion).where(
            PlanVersion.plan_group_id == group_id,
            PlanVersion.version_number.in_((baseline, candidate)),
        )
    ).all()
    by_number = {plan.version_number: plan for plan in versions}
    if baseline not in by_number or candidate not in by_number:
        raise PlanRuleError("Both plan versions must exist in the requested plan group")
    before, after = by_number[baseline], by_number[candidate]
    if before.simulation_start_time != after.simulation_start_time or before.days != after.days:
        raise PlanRuleError("Different time origins/horizons cannot be compared as savings; use the checkpoint's matched remaining-horizon baseline")
    before_schedule = {item["mission_id"]: item for item in before.plan_snapshot.get("schedule", [])}
    after_schedule = {item["mission_id"]: item for item in after.plan_snapshot.get("schedule", [])}
    changes = []
    for mission_id in sorted(set(before_schedule) | set(after_schedule)):
        old, new = before_schedule.get(mission_id, {}), after_schedule.get(mission_id, {})
        if (old.get("selected"), old.get("start_hour")) != (new.get("selected"), new.get("start_hour")):
            changes.append({
                "mission_id": mission_id,
                "before": {"selected": old.get("selected"), "start_hour": old.get("start_hour")},
                "after": {"selected": new.get("selected"), "start_hour": new.get("start_hour")},
            })
    old_objective = before.plan_snapshot.get("objective", {})
    new_objective = after.plan_snapshot.get("objective", {})
    objective_keys = ("priority_weighted_missions", "modeled_total_fuel_liters", "modeled_renewable_curtailed_kwh")
    old_replay = before.explanations.get("replay_impact", {})
    new_replay = after.explanations.get("replay_impact", {})
    replay_keys = ("missions_completed", "total_fuel_consumed_liters", "unserved_energy_kwh", "critical_violation_hours")
    return {
        "plan_group_id": group_id,
        "baseline_version": baseline,
        "candidate_version": candidate,
        "mission_changes": changes,
        "objective_delta": {
            key: _numeric_delta(old_objective.get(key), new_objective.get(key)) for key in objective_keys
        },
        "replay_delta": {key: _numeric_delta(old_replay.get(key), new_replay.get(key)) for key in replay_keys},
    }


def _numeric_delta(before: Any, after: Any) -> float | int | None:
    if isinstance(before, bool) or isinstance(after, bool):
        return None
    if isinstance(before, (float, int)) and isinstance(after, (float, int)):
        return round(after - before, 4)
    return None


def serialize_plan(plan: PlanVersion) -> dict[str, Any]:
    return {
        "id": plan.id,
        "plan_group_id": plan.plan_group_id,
        "version_number": plan.version_number,
        "parent_version_id": plan.parent_version_id,
        "source_simulation_run_id": plan.source_simulation_run_id,
        "station_name": plan.station_name,
        "scenario": plan.scenario,
        "days": plan.days,
        "seed": plan.seed,
        "flexibility_hours": plan.flexibility_hours,
        "simulation_start_time": plan.simulation_start_time,
        "solver_name": plan.solver_name,
        "solver_version": plan.solver_version,
        "planner_model_version": plan.planner_model_version,
        "status": plan.status,
        "plan_snapshot": plan.plan_snapshot,
        "explanations": plan.explanations,
        "created_at": plan.created_at,
        "history": [
            {
                "id": event.id,
                "action": event.action,
                "from_status": event.from_status,
                "to_status": event.to_status,
                "actor": event.actor,
                "note": event.note,
                "details": event.details,
                "created_at": event.created_at,
            }
            for event in plan.history
        ],
    }


def source_run_values(run: SimulationRun) -> tuple[str, int, int, str]:
    config = run.config_snapshot
    start_time = config.get("start_time") or run.started_at.isoformat()
    return run.scenario, run.duration_days, run.seed, start_time
