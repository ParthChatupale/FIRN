"""Persistence models for repeatable simulation runs."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Integer, JSON, String, Uuid, UniqueConstraint, event, func, inspect, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB


class Base(DeclarativeBase):
    pass


def json_document_type() -> JSON:
    """Use portable JSON for tests and JSONB for the PostgreSQL application."""
    return JSON().with_variant(JSONB(), "postgresql")


class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    scenario: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    station_name: Mapped[str] = mapped_column(String(160), nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)
    seed: Mapped[int] = mapped_column(BigInteger, nullable=False)
    simulator_version: Mapped[str] = mapped_column(String(32), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    config_snapshot: Mapped[dict[str, Any]] = mapped_column(json_document_type(), nullable=False)
    summary: Mapped[dict[str, Any]] = mapped_column(json_document_type(), nullable=False)
    mission_results: Mapped[list[dict[str, Any]]] = mapped_column(json_document_type(), nullable=False)
    event_log: Mapped[list[dict[str, Any]]] = mapped_column(json_document_type(), nullable=False)
    telemetry: Mapped[list["SimulationTelemetry"]] = relationship(
        back_populates="run", cascade="all, delete-orphan", order_by="SimulationTelemetry.hour"
    )


class SimulationTelemetry(Base):
    __tablename__ = "simulation_telemetry"

    run_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("simulation_runs.id", ondelete="CASCADE"), primary_key=True
    )
    hour: Mapped[int] = mapped_column(Integer, primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(json_document_type(), nullable=False)
    run: Mapped[SimulationRun] = relationship(back_populates="telemetry")


class PlanVersion(Base):
    """An immutable optimizer/operator plan snapshot with mutable lifecycle state."""

    __tablename__ = "plan_versions"
    __table_args__ = (
        UniqueConstraint("plan_group_id", "version_number", name="uq_plan_versions_group_version"),
        CheckConstraint("version_number > 0", name="ck_plan_versions_positive_version"),
        CheckConstraint(
            "status IN ('proposed', 'reviewed', 'approved', 'active', 'superseded', 'rejected')",
            name="ck_plan_versions_status",
        ),
        CheckConstraint("days > 0", name="ck_plan_versions_positive_days"),
        Index(
            "uq_plan_versions_one_active_per_station",
            "station_name",
            unique=True,
            postgresql_where=text("status = 'active'"),
            sqlite_where=text("status = 'active'"),
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    plan_group_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    parent_version_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("plan_versions.id", ondelete="RESTRICT"), nullable=True
    )
    source_simulation_run_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("simulation_runs.id", ondelete="RESTRICT"), nullable=True
    )
    station_name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    scenario: Mapped[str] = mapped_column(String(40), nullable=False)
    days: Mapped[int] = mapped_column(Integer, nullable=False)
    seed: Mapped[int] = mapped_column(BigInteger, nullable=False)
    flexibility_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    simulation_start_time: Mapped[str] = mapped_column(String(64), nullable=False)
    solver_name: Mapped[str] = mapped_column(String(64), nullable=False)
    solver_version: Mapped[str] = mapped_column(String(32), nullable=False)
    planner_model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="proposed", index=True)
    plan_snapshot: Mapped[dict[str, Any]] = mapped_column(json_document_type(), nullable=False)
    explanations: Mapped[dict[str, Any]] = mapped_column(json_document_type(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    history: Mapped[list["PlanEvent"]] = relationship(
        back_populates="plan_version", cascade="all, delete-orphan", order_by="PlanEvent.created_at"
    )


class PlanEvent(Base):
    """Append-only audit event for proposal, edits, and operator decisions."""

    __tablename__ = "plan_events"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    plan_version_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("plan_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    actor: Mapped[str] = mapped_column(String(100), nullable=False)
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    details: Mapped[dict[str, Any]] = mapped_column(json_document_type(), nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    plan_version: Mapped[PlanVersion] = relationship(back_populates="history")


class MonitoringSession(Base):
    """Persisted simulation clock and alert state for one active-plan replay."""

    __tablename__ = "monitoring_sessions"
    __table_args__ = (
        CheckConstraint("current_hour >= -1", name="ck_monitoring_sessions_hour"),
        CheckConstraint("status IN ('monitoring', 'completed')", name="ck_monitoring_sessions_status"),
        Index("ix_monitoring_sessions_station_status", "station_name", "status"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    station_name: Mapped[str] = mapped_column(String(160), nullable=False)
    plan_version_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("plan_versions.id", ondelete="RESTRICT"), nullable=False
    )
    simulation_run_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("simulation_runs.id", ondelete="RESTRICT"), nullable=False
    )
    current_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=-1)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="monitoring")
    alert_state: Mapped[dict[str, Any]] = mapped_column(json_document_type(), nullable=False, default=dict)
    last_proposal_hour: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pending_proposal_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("plan_versions.id", ondelete="RESTRICT"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class MonitoringEvent(Base):
    """Append-only record of a monitored signal and the resulting control action."""

    __tablename__ = "monitoring_events"
    __table_args__ = (
        Index("ix_monitoring_events_session_hour", "session_id", "hour"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    session_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("monitoring_sessions.id", ondelete="CASCADE"), nullable=False
    )
    hour: Mapped[int] = mapped_column(Integer, nullable=False)
    rule: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    observation: Mapped[dict[str, Any]] = mapped_column(json_document_type(), nullable=False)
    proposal_plan_version_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("plan_versions.id", ondelete="RESTRICT"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )


@event.listens_for(PlanVersion, "before_update")
def prevent_plan_content_mutation(_mapper: Any, _connection: Any, target: PlanVersion) -> None:
    """Permit lifecycle transitions, but never rewrite a version's plan content."""
    state = inspect(target)
    immutable_fields = (
        "plan_group_id", "version_number", "parent_version_id", "source_simulation_run_id",
        "station_name", "scenario", "days", "seed", "flexibility_hours", "simulation_start_time",
        "solver_name", "solver_version", "planner_model_version", "plan_snapshot", "explanations",
    )
    if any(state.attrs[field].history.has_changes() for field in immutable_fields):
        raise ValueError("Plan version content is immutable; create a child version instead")


@event.listens_for(PlanEvent, "before_update")
@event.listens_for(PlanEvent, "before_delete")
def prevent_plan_event_mutation(*_args: Any) -> None:
    raise ValueError("Plan history is append-only")


@event.listens_for(MonitoringEvent, "before_update")
@event.listens_for(MonitoringEvent, "before_delete")
def prevent_monitoring_event_mutation(*_args: Any) -> None:
    raise ValueError("Monitoring history is append-only")
