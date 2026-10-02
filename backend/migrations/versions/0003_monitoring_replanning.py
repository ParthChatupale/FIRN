"""Persist simulation monitoring sessions and alerts."""

from typing import Sequence
from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0003_monitoring_replanning"
down_revision: str | None = "0002_plan_management"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "monitoring_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid4),
        sa.Column("station_name", sa.String(length=160), nullable=False),
        sa.Column("plan_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("simulation_run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("current_hour", sa.Integer(), nullable=False, server_default="-1"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="monitoring"),
        sa.Column("alert_state", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("last_proposal_hour", sa.Integer(), nullable=True),
        sa.Column("pending_proposal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("current_hour >= -1", name="ck_monitoring_sessions_hour"),
        sa.CheckConstraint(
            "status IN ('monitoring', 'completed')", name="ck_monitoring_sessions_status"
        ),
        sa.ForeignKeyConstraint(["plan_version_id"], ["plan_versions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["simulation_run_id"], ["simulation_runs.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["pending_proposal_id"], ["plan_versions.id"], ondelete="RESTRICT"),
    )
    op.create_index(
        "ix_monitoring_sessions_station_status", "monitoring_sessions", ["station_name", "status"]
    )

    op.create_table(
        "monitoring_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid4),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hour", sa.Integer(), nullable=False),
        sa.Column("rule", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("observation", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("proposal_plan_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["monitoring_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["proposal_plan_version_id"], ["plan_versions.id"], ondelete="RESTRICT"
        ),
    )
    op.create_index("ix_monitoring_events_session_hour", "monitoring_events", ["session_id", "hour"])
    op.create_index("ix_monitoring_events_created_at", "monitoring_events", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_monitoring_events_created_at", table_name="monitoring_events")
    op.drop_index("ix_monitoring_events_session_hour", table_name="monitoring_events")
    op.drop_table("monitoring_events")
    op.drop_index("ix_monitoring_sessions_station_status", table_name="monitoring_sessions")
    op.drop_table("monitoring_sessions")
