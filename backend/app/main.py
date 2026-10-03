"""FastAPI application for FIRN's simulation vertical slice."""

from __future__ import annotations

import os
from dataclasses import asdict
from datetime import datetime
from importlib.metadata import PackageNotFoundError, version
from typing import Any
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from backend.app.db import DatabaseNotConfigured, get_db, get_engine
from backend.app.models import PlanVersion, SimulationRun, SimulationTelemetry
from backend.app.models import MonitoringSession
from backend.app.monitoring import (
    advance_monitoring_session,
    serialize_monitoring_session,
    start_monitoring_session,
    _session_data,
)
from backend.app.plans import (
    PlanRuleError,
    PlanningFailure,
    apply_plan_action,
    compare_versions,
    create_edited_version,
    create_proposal,
    serialize_plan,
    source_run_values,
)
from backend.app.schemas import (
    PlanActionRequest,
    PlanComparison,
    PlanProposalCreate,
    PlanVersionEdit,
    PlanVersionList,
    PlanVersionRead,
    MonitoringAdvanceRequest,
    MonitoringSessionCreate,
    MonitoringSessionRead,
    SimulationRunCreate,
    SimulationRunList,
    SimulationRunRead,
    TelemetryPage,
    OutlookRead,
)
from backend.simulation import SimulationEngine, SimulationConfig
from backend.simulation.scenarios import build_scenario
from backend.app.outlook import case_outlook

try:
    SIMULATOR_VERSION = version("firn-polar-ops")
except PackageNotFoundError:
    SIMULATOR_VERSION = "0.1.0"

app = FastAPI(title="FIRN API", version="0.1.0")
cors_origins = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://[::1]:3000,"
        "http://localhost:5173,http://127.0.0.1:5173,http://[::1]:5173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    # Vite may bind a different local port or IPv6 loopback when a default port is busy.
    # Keep this narrowly scoped to loopback addresses rather than opening CORS generally.
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|\[::1\]):\d+$",
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(DatabaseNotConfigured)
def handle_database_not_configured(_request: Any, _exc: DatabaseNotConfigured) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"detail": "DATABASE_URL is not configured"},
    )


@app.exception_handler(SQLAlchemyError)
def handle_database_error(_request: Any, _exc: SQLAlchemyError) -> JSONResponse:
    """Return a usable API error when the local database cannot be reached."""
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Database connection unavailable. Run the FIRN API from WSL when PostgreSQL is running in WSL."
        },
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
    except (DatabaseNotConfigured, ValueError):
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "database": "not_configured"},
        )
    except SQLAlchemyError:
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "database": "unavailable"},
        )
    return {"status": "ok", "database": "ok"}


@app.get("/api/station")
def station() -> dict[str, Any]:
    config = build_scenario("normal", days=30).station
    station_data = asdict(config)
    return {
        "name": config.name,
        "profile": "synthetic_reference_station",
        "configuration": station_data,
    }


@app.post("/api/simulation-runs", response_model=SimulationRunRead, status_code=201)
def create_simulation_run(
    request: SimulationRunCreate,
    db: Session = Depends(get_db),
) -> SimulationRun:
    try:
        config = build_scenario(request.scenario, days=request.days, seed=request.seed)
        if request.start_time is not None:
            config = SimulationConfig(
                days=config.days,
                seed=config.seed,
                start_time=request.start_time.isoformat(),
                station=config.station,
                events=config.events,
            )
        result = SimulationEngine().run(config)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    run = SimulationRun(
        scenario=request.scenario,
        station_name=result.station_name,
        duration_days=request.days,
        seed=request.seed,
        simulator_version=SIMULATOR_VERSION,
        started_at=datetime.fromisoformat(result.start_time),
        config_snapshot=asdict(config),
        summary=result.summary,
        mission_results=result.mission_results,
        event_log=result.event_log,
        telemetry=[
            SimulationTelemetry(hour=row["hour"], payload=row)
            for row in result.telemetry
        ],
    )
    db.add(run)
    try:
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Could not persist simulation run") from exc
    db.refresh(run)
    return run


@app.get("/api/simulation-runs", response_model=SimulationRunList)
def list_simulation_runs(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> SimulationRunList:
    runs = db.scalars(
        select(SimulationRun)
        .order_by(SimulationRun.created_at.desc(), SimulationRun.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return SimulationRunList(items=list(runs), limit=limit, offset=offset)


@app.get("/api/simulation-runs/{run_id}", response_model=SimulationRunRead)
def get_simulation_run(run_id: UUID, db: Session = Depends(get_db)) -> SimulationRun:
    run = db.get(SimulationRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    return run


@app.get("/api/simulation-runs/{run_id}/telemetry", response_model=TelemetryPage)
def get_run_telemetry(
    run_id: UUID,
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> TelemetryPage:
    if db.get(SimulationRun, run_id) is None:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    rows = db.scalars(
        select(SimulationTelemetry)
        .where(SimulationTelemetry.run_id == run_id)
        .order_by(SimulationTelemetry.hour)
        .limit(limit)
        .offset(offset)
    ).all()
    total = db.scalar(
        select(func.count())
        .select_from(SimulationTelemetry)
        .where(SimulationTelemetry.run_id == run_id)
    ) or 0
    return TelemetryPage(
        items=[row.payload for row in rows], limit=limit, offset=offset, total=total
    )


@app.get("/api/simulation-runs/{run_id}/events", response_model=list[dict[str, Any]])
def get_run_events(run_id: UUID, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    run = db.get(SimulationRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    return run.event_log


@app.get("/api/simulation-runs/{run_id}/missions", response_model=list[dict[str, Any]])
def get_run_missions(run_id: UUID, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    run = db.get(SimulationRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    return run.mission_results


@app.get("/api/simulation-runs/{run_id}/outlook", response_model=OutlookRead)
def get_outlook(run_id: UUID, origin_hour: int = Query(default=0, ge=0),
                horizon_hours: int = Query(default=24, ge=1, le=72),
                monitoring_session_id: UUID | None = None, db: Session = Depends(get_db)):
    run = db.get(SimulationRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    rows = db.scalars(select(SimulationTelemetry).where(SimulationTelemetry.run_id == run_id)
                      .order_by(SimulationTelemetry.hour)).all()
    telemetry = [r.payload for r in rows]
    if monitoring_session_id is not None:
        session = db.get(MonitoringSession, monitoring_session_id)
        if session is None or session.simulation_run_id != run_id:
            raise HTTPException(status_code=404, detail="Matching monitoring session not found")
        if origin_hour > session.current_hour:
            raise HTTPException(status_code=409, detail="Forecast origin has not been observed")
        _, telemetry = _session_data(db, session, run)
    try:
        result = case_outlook(run, telemetry, origin_hour, horizon_hours)
        result["forecast"]["observation_source"] = (
            "monitoring_session" if monitoring_session_id is not None else "saved_run"
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _get_plan(db: Session, plan_id: UUID) -> PlanVersion:
    plan = db.scalar(
        select(PlanVersion)
        .options(selectinload(PlanVersion.history))
        .where(PlanVersion.id == plan_id)
    )
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan version not found")
    return plan


@app.post("/api/plan-proposals", response_model=PlanVersionRead, status_code=201)
def propose_plan(request: PlanProposalCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    if request.request_id:
        # PostgreSQL transaction-level lock serializes retries across workers, without new tables.
        if db.get_bind().dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": request.request_id.int % (2**63)})
        existing = db.scalar(select(PlanVersion).where(
            PlanVersion.plan_snapshot["planning_context"]["request_id"].as_string() == str(request.request_id)))
        if existing:
            context = existing.plan_snapshot.get("planning_context", {})
            if (existing.source_simulation_run_id != request.source_simulation_run_id or
                context.get("mode") != request.planning_mode or existing.flexibility_hours != request.flexibility_hours or
                any(value is not None and value != getattr(existing, field) for field, value in
                    (("scenario", request.scenario), ("days", request.days), ("seed", request.seed)))):
                raise HTTPException(status_code=409, detail="This request ID already belongs to different planning inputs")
            return serialize_plan(_get_plan(db, existing.id))
    source_run = db.get(SimulationRun, request.source_simulation_run_id) if request.source_simulation_run_id else None
    if request.source_simulation_run_id and source_run is None:
        raise HTTPException(status_code=404, detail="Source simulation run not found")

    if source_run is not None:
        source_scenario, source_days, source_seed, source_start = source_run_values(source_run)
        provided = (
            ("scenario", request.scenario, source_scenario),
            ("days", request.days, source_days),
            ("seed", request.seed, source_seed),
        )
        mismatches = [name for name, value, source in provided if value is not None and value != source]
        if mismatches:
            raise HTTPException(
                status_code=422,
                detail=f"Plan inputs must match the linked simulation run: {', '.join(mismatches)}",
            )
        scenario, days, seed, start_time = source_scenario, source_days, source_seed, source_start
    else:
        scenario = request.scenario or "normal"
        days = request.days or 7
        seed = 42 if request.seed is None else request.seed
        if days > 30:
            raise HTTPException(status_code=422, detail="Plan proposals are limited to 30 days")
        from backend.simulation.scenarios import build_scenario
        start_time = build_scenario(scenario, days=days, seed=seed).start_time

    if days > 30:
        raise HTTPException(status_code=422, detail="Plan proposals are limited to 30 days")

    try:
        plan = create_proposal(
            db,
            scenario=scenario,
            days=days,
            seed=seed,
            flexibility_hours=request.flexibility_hours,
            start_time=start_time,
            source_run=source_run,
            planning_mode=request.planning_mode, request_id=str(request.request_id) if request.request_id else None,
        )
        db.commit()
        return serialize_plan(_get_plan(db, plan.id))
    except PlanningFailure as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=exc.result) from exc
    except PlanRuleError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (ValueError, RuntimeError) as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Could not persist plan proposal") from exc


@app.get("/api/plan-groups/{group_id}/versions", response_model=PlanVersionList)
def list_plan_versions(
    group_id: UUID,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> PlanVersionList:
    plans = db.scalars(
        select(PlanVersion)
        .options(selectinload(PlanVersion.history))
        .where(PlanVersion.plan_group_id == group_id)
        .order_by(PlanVersion.version_number)
        .limit(limit)
        .offset(offset)
    ).all()
    return PlanVersionList(items=[serialize_plan(plan) for plan in plans], limit=limit, offset=offset)


@app.get("/api/plans", response_model=PlanVersionList)
def list_plans(
    status: str | None = Query(default=None, pattern="^(proposed|reviewed|approved|active|superseded|rejected)$"),
    station_name: str | None = Query(default=None, min_length=1, max_length=160),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> PlanVersionList:
    statement = select(PlanVersion).options(selectinload(PlanVersion.history))
    if status:
        statement = statement.where(PlanVersion.status == status)
    if station_name:
        statement = statement.where(PlanVersion.station_name == station_name)
    plans = db.scalars(
        statement.order_by(PlanVersion.created_at.desc(), PlanVersion.id.desc())
        .limit(limit).offset(offset)
    ).all()
    return PlanVersionList(items=[serialize_plan(plan) for plan in plans], limit=limit, offset=offset)


@app.get("/api/plans/{plan_id}", response_model=PlanVersionRead)
def get_plan(plan_id: UUID, db: Session = Depends(get_db)) -> dict[str, Any]:
    return serialize_plan(_get_plan(db, plan_id))


@app.post("/api/plans/{plan_id}/edits", response_model=PlanVersionRead, status_code=201)
def edit_plan(
    plan_id: UUID, request: PlanVersionEdit, actor: str = Query(default="operator", min_length=1, max_length=100),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    parent = _get_plan(db, plan_id)
    try:
        if request.request_id and db.get_bind().dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": request.request_id.int % (2**63)})
        plan = create_edited_version(db, parent, request.mission_start_hours, actor=actor,
                                    request_id=str(request.request_id) if request.request_id else None)
        db.commit()
        return serialize_plan(_get_plan(db, plan.id))
    except PlanningFailure as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=exc.result) from exc
    except PlanRuleError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (ValueError, RuntimeError) as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Concurrent plan version creation; retry the edit") from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Could not persist edited plan version") from exc


@app.post("/api/plans/{plan_id}/actions", response_model=PlanVersionRead)
def plan_action(
    plan_id: UUID, request: PlanActionRequest, db: Session = Depends(get_db)
) -> dict[str, Any]:
    plan = _get_plan(db, plan_id)
    try:
        apply_plan_action(db, plan, action=request.action, actor=request.actor, note=request.note)
        db.commit()
        return serialize_plan(_get_plan(db, plan.id))
    except PlanRuleError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Another plan is active for this station; retry the action") from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Could not record plan action") from exc


@app.get("/api/plan-groups/{group_id}/compare", response_model=PlanComparison)
def compare_plan_versions(
    group_id: UUID,
    baseline_version: int = Query(ge=1),
    candidate_version: int = Query(ge=1),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    try:
        return compare_versions(db, group_id, baseline_version, candidate_version)
    except PlanRuleError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post(
    "/api/monitoring-sessions",
    response_model=MonitoringSessionRead,
    status_code=201,
)
def create_monitoring_session(
    request: MonitoringSessionCreate, db: Session = Depends(get_db)
) -> dict[str, Any]:
    try:
        session = start_monitoring_session(
            db,
            plan_version_id=request.plan_version_id,
            simulation_run_id=request.simulation_run_id,
        )
        db.commit()
        return serialize_monitoring_session(db, session)
    except PlanRuleError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Could not start monitoring session") from exc


@app.get("/api/monitoring-sessions/{session_id}", response_model=MonitoringSessionRead)
def get_monitoring_session(
    session_id: UUID, db: Session = Depends(get_db)
) -> dict[str, Any]:
    session = db.get(MonitoringSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Monitoring session not found")
    return serialize_monitoring_session(db, session)


@app.post(
    "/api/monitoring-sessions/{session_id}/advance",
    response_model=MonitoringSessionRead,
)
def advance_monitoring(
    session_id: UUID,
    request: MonitoringAdvanceRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    session = db.scalar(
        select(MonitoringSession)
        .where(MonitoringSession.id == session_id)
        .with_for_update()
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Monitoring session not found")
    try:
        if request.expected_hour is not None and request.expected_hour != session.current_hour:
            raise PlanRuleError("Operating clock changed; refresh before retrying advancement")
        advance_monitoring_session(db, session, hours=request.hours)
        db.commit()
        return serialize_monitoring_session(db, session)
    except PlanRuleError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Could not advance monitoring session") from exc
