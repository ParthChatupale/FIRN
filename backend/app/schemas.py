"""HTTP request and response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

ScenarioName = Literal[
    "normal",
    "storm",
    "generator_failure",
    "resupply_delay",
    "low_renewable",
    "mission_energy",
    "battery_capacity_loss",
]


class SimulationRunCreate(BaseModel):
    scenario: ScenarioName = "normal"
    days: int = Field(default=30, ge=2, le=365)
    seed: int = Field(default=42, ge=-(2**63), le=2**63 - 1)
    start_time: datetime | None = None


class SimulationRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scenario: str
    station_name: str
    duration_days: int
    seed: int
    simulator_version: str
    started_at: datetime
    created_at: datetime
    config_snapshot: dict[str, Any]
    summary: dict[str, Any]
    mission_results: list[dict[str, Any]]


class SimulationRunList(BaseModel):
    items: list[SimulationRunRead]
    limit: int
    offset: int


class TelemetryPage(BaseModel):
    items: list[dict[str, Any]]
    limit: int
    offset: int
    total: int


class PlanProposalCreate(BaseModel):
    scenario: ScenarioName | None = None
    days: int | None = Field(default=None, ge=2, le=30)
    seed: int | None = Field(default=None, ge=-(2**63), le=2**63 - 1)
    flexibility_hours: int = Field(default=12, ge=0, le=72)
    source_simulation_run_id: UUID | None = None
    planning_mode: Literal["saved", "nominal", "adverse", "robust"] = "saved"
    request_id: UUID | None = None


class OutlookRead(BaseModel):
    source_run_id: UUID
    config_fingerprint: str
    origin_hour: int
    horizon_hours: int
    forecast: dict[str, Any]
    cases: list[dict[str, Any]]
    assumptions: dict[str, Any]


class PlanVersionEdit(BaseModel):
    mission_start_hours: dict[str, int] = Field(min_length=1)
    request_id: UUID | None = None


class PlanActionRequest(BaseModel):
    action: Literal["review", "approve", "reject", "activate"]
    actor: str = Field(default="operator", min_length=1, max_length=100)
    note: str | None = Field(default=None, max_length=1000)


class PlanVersionRead(BaseModel):
    id: UUID
    plan_group_id: UUID
    version_number: int
    parent_version_id: UUID | None
    source_simulation_run_id: UUID | None
    station_name: str
    scenario: str
    days: int
    seed: int
    flexibility_hours: int
    simulation_start_time: str
    solver_name: str
    solver_version: str
    planner_model_version: str
    status: str
    plan_snapshot: dict[str, Any]
    explanations: dict[str, Any]
    created_at: datetime
    history: list[dict[str, Any]]


class PlanVersionList(BaseModel):
    items: list[PlanVersionRead]
    limit: int
    offset: int


class PlanComparison(BaseModel):
    plan_group_id: UUID
    baseline_version: int
    candidate_version: int
    mission_changes: list[dict[str, Any]]
    objective_delta: dict[str, float | None]
    replay_delta: dict[str, float | int | None]


class MonitoringSessionCreate(BaseModel):
    plan_version_id: UUID
    simulation_run_id: UUID


class MonitoringAdvanceRequest(BaseModel):
    hours: int = Field(default=1, ge=1, le=24)
    expected_hour: int | None = Field(default=None, ge=-1)


class MonitoringEventRead(BaseModel):
    id: UUID
    hour: int
    rule: str
    severity: str
    action: str
    observation: dict[str, Any]
    proposal_plan_version_id: UUID | None
    created_at: datetime


class MonitoringSessionRead(BaseModel):
    id: UUID
    station_name: str
    plan_version_id: UUID
    simulation_run_id: UUID
    current_hour: int
    status: str
    last_proposal_hour: int | None
    pending_proposal_id: UUID | None
    latest_observation: dict[str, Any] | None
    plan_origin_hour: int = 0
    execution_policy: str = "original_case_replay"
    trajectory: list[dict[str, Any]] = []
    active_alerts: list[dict[str, Any]] = []
    observed_events: list[dict[str, Any]] = []
    events: list[MonitoringEventRead]
    created_at: datetime
    updated_at: datetime
