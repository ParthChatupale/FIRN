"""Add immutable plan versions and operator decision history."""

from typing import Sequence
from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0002_plan_management"
down_revision: str | None = "0001_simulation_runs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "plan_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid4),
        sa.Column("plan_group_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("parent_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_simulation_run_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("station_name", sa.String(length=160), nullable=False),
        sa.Column("scenario", sa.String(length=40), nullable=False),
        sa.Column("days", sa.Integer(), nullable=False),
        sa.Column("seed", sa.BigInteger(), nullable=False),
        sa.Column("flexibility_hours", sa.Integer(), nullable=False),
        sa.Column("simulation_start_time", sa.String(length=64), nullable=False),
        sa.Column("solver_name", sa.String(length=64), nullable=False),
        sa.Column("solver_version", sa.String(length=32), nullable=False),
        sa.Column("planner_model_version", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("plan_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("explanations", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("version_number > 0", name="ck_plan_versions_positive_version"),
        sa.CheckConstraint("days > 0", name="ck_plan_versions_positive_days"),
        sa.CheckConstraint(
            "status IN ('proposed', 'reviewed', 'approved', 'active', 'superseded', 'rejected')",
            name="ck_plan_versions_status",
        ),
        sa.ForeignKeyConstraint(
            ["parent_version_id"], ["plan_versions.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["source_simulation_run_id"], ["simulation_runs.id"], ondelete="RESTRICT"
        ),
        sa.UniqueConstraint("plan_group_id", "version_number", name="uq_plan_versions_group_version"),
    )
    op.create_index("ix_plan_versions_plan_group_id", "plan_versions", ["plan_group_id"])
    op.create_index("ix_plan_versions_station_name", "plan_versions", ["station_name"])
    op.create_index("ix_plan_versions_status", "plan_versions", ["status"])
    op.create_index("ix_plan_versions_created_at", "plan_versions", ["created_at"])
    op.create_index(
        "uq_plan_versions_one_active_per_station",
        "plan_versions",
        ["station_name"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    op.create_table(
        "plan_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid4),
        sa.Column("plan_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("from_status", sa.String(length=16), nullable=True),
        sa.Column("to_status", sa.String(length=16), nullable=True),
        sa.Column("actor", sa.String(length=100), nullable=False),
        sa.Column("note", sa.String(length=1000), nullable=True),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["plan_version_id"], ["plan_versions.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_plan_events_plan_version_id", "plan_events", ["plan_version_id"])
    op.create_index("ix_plan_events_created_at", "plan_events", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_plan_events_created_at", table_name="plan_events")
    op.drop_index("ix_plan_events_plan_version_id", table_name="plan_events")
    op.drop_table("plan_events")
    op.drop_index("uq_plan_versions_one_active_per_station", table_name="plan_versions")
    op.drop_index("ix_plan_versions_created_at", table_name="plan_versions")
    op.drop_index("ix_plan_versions_status", table_name="plan_versions")
    op.drop_index("ix_plan_versions_station_name", table_name="plan_versions")
    op.drop_index("ix_plan_versions_plan_group_id", table_name="plan_versions")
    op.drop_table("plan_versions")
