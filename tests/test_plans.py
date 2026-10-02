from __future__ import annotations

from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.models import Base, PlanEvent, PlanVersion


def _proposal(client: TestClient) -> dict:
    response = client.post(
        "/api/plan-proposals",
        json={"scenario": "normal", "days": 2, "seed": 51, "flexibility_hours": 12},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_proposal_is_persisted_explained_and_not_activated(api_client: TestClient) -> None:
    created = _proposal(api_client)
    assert created["status"] == "proposed"
    assert created["version_number"] == 1
    assert created["plan_snapshot"]["solver"] == "HiGHS"
    assert created["solver_name"] == "HiGHS"
    assert created["solver_version"]
    assert created["planner_model_version"] == "firn-joint-mission-energy-milp-v1"
    assert created["plan_snapshot"]["dispatch"]
    assert created["explanations"]["mission_decisions"]
    assert created["history"][0]["action"] == "proposal_created"
    assert api_client.get("/api/plans?status=active").json()["items"] == []

    fetched = api_client.get(f"/api/plans/{created['id']}")
    versions = api_client.get(f"/api/plan-groups/{created['plan_group_id']}/versions")
    assert fetched.status_code == 200
    assert versions.status_code == 200
    assert [item["version_number"] for item in versions.json()["items"]] == [1]


def test_review_approval_and_activation_are_explicit_and_audited(api_client: TestClient) -> None:
    plan = _proposal(api_client)
    plan_id = plan["id"]

    denied = api_client.post(
        f"/api/plans/{plan_id}/actions", json={"action": "activate", "actor": "operator-a"}
    )
    assert denied.status_code == 409
    assert api_client.get(f"/api/plans/{plan_id}").json()["status"] == "proposed"

    reviewed = api_client.post(
        f"/api/plans/{plan_id}/actions",
        json={"action": "review", "actor": "operator-a", "note": "Checked mission windows"},
    )
    assert reviewed.status_code == 200, reviewed.text
    assert reviewed.json()["status"] == "reviewed"
    approved = api_client.post(
        f"/api/plans/{plan_id}/actions", json={"action": "approve", "actor": "operator-b"}
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    active = api_client.post(
        f"/api/plans/{plan_id}/actions", json={"action": "activate", "actor": "operator-b"}
    )
    assert active.status_code == 200, active.text
    assert active.json()["status"] == "active"
    assert [event["action"] for event in active.json()["history"]] == [
        "proposal_created", "review", "approve", "activate"
    ]


def test_rejection_is_recorded_and_terminal(api_client: TestClient) -> None:
    plan = _proposal(api_client)
    rejected = api_client.post(
        f"/api/plans/{plan['id']}/actions",
        json={"action": "reject", "actor": "operator-d", "note": "Weather window risk"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    assert rejected.json()["history"][-1]["note"] == "Weather window risk"
    cannot_approve = api_client.post(
        f"/api/plans/{plan['id']}/actions", json={"action": "approve", "actor": "operator-d"}
    )
    assert cannot_approve.status_code == 409


def test_activating_a_replacement_supersedes_prior_active_plan(api_client: TestClient) -> None:
    first = _proposal(api_client)
    for action in ("approve", "activate"):
        result = api_client.post(
            f"/api/plans/{first['id']}/actions", json={"action": action, "actor": "operator"}
        )
        assert result.status_code == 200, result.text

    second = _proposal(api_client)
    for action in ("approve", "activate"):
        result = api_client.post(
            f"/api/plans/{second['id']}/actions", json={"action": action, "actor": "operator"}
        )
        assert result.status_code == 200, result.text

    assert api_client.get(f"/api/plans/{first['id']}").json()["status"] == "superseded"
    assert api_client.get(f"/api/plans/{second['id']}").json()["status"] == "active"
    active = api_client.get("/api/plans?status=active").json()["items"]
    assert [plan["id"] for plan in active] == [second["id"]]


def test_operator_edit_creates_new_immutable_version_and_comparison(api_client: TestClient) -> None:
    parent = _proposal(api_client)
    chosen = next(
        item for item in parent["plan_snapshot"]["schedule"]
        if item["mission_id"] == "ice-core" and item["selected"]
    )
    new_start = chosen["start_hour"] + 1
    edit = api_client.post(
        f"/api/plans/{parent['id']}/edits?actor=operator-c",
        json={"mission_start_hours": {chosen["mission_id"]: new_start}},
    )
    assert edit.status_code == 201, edit.text
    child = edit.json()
    assert child["version_number"] == 2
    assert child["parent_version_id"] == parent["id"]
    assert child["status"] == "proposed"

    comparison = api_client.get(
        f"/api/plan-groups/{parent['plan_group_id']}/compare?baseline_version=1&candidate_version=2"
    )
    assert comparison.status_code == 200, comparison.text
    assert comparison.json()["mission_changes"] == [{
        "mission_id": "ice-core",
        "before": {"selected": True, "start_hour": chosen["start_hour"]},
        "after": {"selected": True, "start_hour": new_start},
    }]
    child_decision = next(
        item for item in child["explanations"]["mission_decisions"]
        if item["mission_id"] == "ice-core"
    )
    assert child_decision["decision"] == "operator_rescheduled"
    assert "before_after_impact" in child["explanations"]


def test_source_simulation_run_is_linked_and_conflicting_inputs_rejected(api_client: TestClient) -> None:
    run_response = api_client.post(
        "/api/simulation-runs", json={"scenario": "normal", "days": 2, "seed": 51}
    )
    assert run_response.status_code == 201, run_response.text
    run = run_response.json()
    plan_response = api_client.post(
        "/api/plan-proposals", json={"source_simulation_run_id": run["id"]}
    )
    assert plan_response.status_code == 201, plan_response.text
    assert plan_response.json()["source_simulation_run_id"] == run["id"]
    assert plan_response.json()["seed"] == run["seed"]
    conflict = api_client.post(
        "/api/plan-proposals",
        json={"source_simulation_run_id": run["id"], "seed": 52},
    )
    assert conflict.status_code == 422


def test_plan_content_and_history_are_immutable() -> None:
    engine = create_engine("sqlite+pysqlite://")
    Base.metadata.create_all(engine)
    plan_id = UUID("11111111-1111-1111-1111-111111111111")
    with Session(engine) as db:
        plan = PlanVersion(
            id=plan_id,
            plan_group_id=UUID("22222222-2222-2222-2222-222222222222"),
            version_number=1,
            station_name="Test Station",
            scenario="normal",
            days=2,
            seed=4,
            flexibility_hours=0,
            simulation_start_time="2032-01-01T00:00:00+00:00",
            solver_name="HiGHS",
            solver_version="1.15.1",
            planner_model_version="firn-joint-mission-energy-milp-v1",
            status="proposed",
            plan_snapshot={"schedule": []},
            explanations={},
        )
        event = PlanEvent(plan_version=plan, action="proposal_created", actor="system", details={})
        db.add_all([plan, event])
        db.commit()
        plan.plan_snapshot = {"tampered": True}
        with pytest.raises(ValueError, match="immutable"):
            db.commit()
        db.rollback()
        event.action = "rewritten"
        with pytest.raises(ValueError, match="append-only"):
            db.commit()
    engine.dispose()

