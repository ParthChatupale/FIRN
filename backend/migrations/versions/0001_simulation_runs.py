"""Create persisted simulation runs and hourly telemetry."""

from typing import Sequence
from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_simulation_runs"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "simulation_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid4),
        sa.Column("scenario", sa.String(length=40), nullable=False),
        sa.Column("station_name", sa.String(length=160), nullable=False),
        sa.Column("duration_days", sa.Integer(), nullable=False),
        sa.Column("seed", sa.BigInteger(), nullable=False),
        sa.Column("simulator_version", sa.String(length=32), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("config_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("summary", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("mission_results", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("event_log", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    )
    op.create_index("ix_simulation_runs_scenario", "simulation_runs", ["scenario"])
    op.create_index("ix_simulation_runs_created_at", "simulation_runs", ["created_at"])

    op.create_table(
        "simulation_telemetry",
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hour", sa.Integer(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["simulation_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("run_id", "hour"),
    )


def downgrade() -> None:
    op.drop_table("simulation_telemetry")
    op.drop_index("ix_simulation_runs_created_at", table_name="simulation_runs")
    op.drop_index("ix_simulation_runs_scenario", table_name="simulation_runs")
    op.drop_table("simulation_runs")
