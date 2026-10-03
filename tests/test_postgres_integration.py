from __future__ import annotations

import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from backend.app.db import get_db
from backend.app.main import app
from uuid import uuid4


def test_outlook_and_idempotent_robust_proposal_in_postgres(postgres_api_client):
    client = postgres_api_client
    run = client.post("/api/simulation-runs", json={"scenario": "normal", "days": 2, "seed": 51}).json()
    outlook = client.get(f"/api/simulation-runs/{run['id']}/outlook")
    assert outlook.status_code == 200, outlook.text
    payload = {"source_simulation_run_id": run["id"], "request_id": str(uuid4()), "planning_mode": "robust"}
    first = client.post("/api/plan-proposals", json=payload)
    assert first.status_code == 201, first.text
    retry = client.post("/api/plan-proposals", json=payload)
    assert retry.status_code == 201, retry.text
    assert retry.json()["id"] == first.json()["id"]
    assert first.json()["plan_snapshot"]["planning_context"]["config_fingerprint"] == outlook.json()["config_fingerprint"]
    conflict = client.post("/api/plan-proposals", json={**payload, "seed": 52})
    assert conflict.status_code == 409
    parent = first.json()
    mission = next(m for m in parent["plan_snapshot"]["schedule"] if m["mission_id"] == "ice-core")
    edit_payload = {"mission_start_hours": {"ice-core": mission["start_hour"] + 1}, "request_id": str(uuid4())}
    endpoint = f"/api/plans/{parent['id']}/edits"
    edit = client.post(endpoint, json=edit_payload)
    assert edit.status_code == 201, edit.text
    retry_edit = client.post(endpoint, json=edit_payload)
    assert retry_edit.json()["id"] == edit.json()["id"]


@pytest.fixture
def postgres_api_client() -> Generator[TestClient, None, None]:
    database_url = os.environ.get("FIRN_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("Set FIRN_TEST_DATABASE_URL to run PostgreSQL integration tests")

    url = make_url(database_url)
    if url.drivername != "postgresql+psycopg" or url.database != "firn_test_db":
        pytest.fail("PostgreSQL integration tests are restricted to firn_test_db")

    engine = create_engine(url, pool_pre_ping=True)
    connection = engine.connect()
    transaction = connection.begin()
    try:
        revision = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one_or_none()
        if revision != "0003_monitoring_replanning":
            pytest.fail(
                "firn_test_db must be migrated to 0003_monitoring_replanning before running integration tests"
            )

        session_factory = sessionmaker(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )

        def override_get_db() -> Generator[Session, None, None]:
            with session_factory() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.pop(get_db, None)
        if transaction.is_active:
            transaction.rollback()
        connection.close()
        engine.dispose()


def test_plan_lifecycle_persists_and_replaces_active_version_in_postgres(
    postgres_api_client: TestClient,
) -> None:
    first_response = postgres_api_client.post(
        "/api/plan-proposals",
        json={"scenario": "normal", "days": 2, "seed": 513, "flexibility_hours": 12},
    )
    assert first_response.status_code == 201, first_response.text
    first = first_response.json()
    assert first["status"] == "proposed"
    assert first["plan_snapshot"]["dispatch"]

    for action in ("review", "approve", "activate"):
        response = postgres_api_client.post(
            f"/api/plans/{first['id']}/actions",
            json={"action": action, "actor": "postgres-integration-test"},
        )
        assert response.status_code == 200, response.text

    persisted_first = postgres_api_client.get(f"/api/plans/{first['id']}").json()
    assert persisted_first["status"] == "active"
    assert [event["action"] for event in persisted_first["history"]] == [
        "proposal_created", "review", "approve", "activate"
    ]

    second_response = postgres_api_client.post(
        "/api/plan-proposals",
        json={"scenario": "normal", "days": 2, "seed": 514, "flexibility_hours": 12},
    )
    assert second_response.status_code == 201, second_response.text
    second = second_response.json()
    for action in ("approve", "activate"):
        response = postgres_api_client.post(
            f"/api/plans/{second['id']}/actions",
            json={"action": action, "actor": "postgres-integration-test"},
        )
        assert response.status_code == 200, response.text

    assert postgres_api_client.get(f"/api/plans/{first['id']}").json()["status"] == "superseded"
    active = postgres_api_client.get("/api/plans?status=active").json()["items"]
    assert [plan["id"] for plan in active] == [second["id"]]


def test_monitoring_clock_persists_on_postgres(postgres_api_client: TestClient) -> None:
    run_response = postgres_api_client.post(
        "/api/simulation-runs", json={"scenario": "normal", "days": 2, "seed": 711}
    )
    assert run_response.status_code == 201, run_response.text
    run = run_response.json()
    proposal_response = postgres_api_client.post(
        "/api/plan-proposals",
        json={"source_simulation_run_id": run["id"], "flexibility_hours": 4},
    )
    assert proposal_response.status_code == 201, proposal_response.text
    plan = proposal_response.json()
    for action in ("approve", "activate"):
        response = postgres_api_client.post(
            f"/api/plans/{plan['id']}/actions",
            json={"action": action, "actor": "postgres-monitor-test"},
        )
        assert response.status_code == 200, response.text

    created = postgres_api_client.post(
        "/api/monitoring-sessions",
        json={"plan_version_id": plan["id"], "simulation_run_id": run["id"]},
    )
    assert created.status_code == 201, created.text
    advanced = postgres_api_client.post(
        f"/api/monitoring-sessions/{created.json()['id']}/advance", json={"hours": 1}
    )
    assert advanced.status_code == 200, advanced.text
    assert advanced.json()["current_hour"] == 0
    fetched = postgres_api_client.get(f"/api/monitoring-sessions/{created.json()['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["latest_observation"]["hour"] == 0


def test_checkpoint_activation_continuation_persists_on_postgres(postgres_api_client):
    client = postgres_api_client
    run = client.post("/api/simulation-runs", json={"scenario":"low_renewable","days":2,"seed":73}).json()
    proposal = client.post("/api/plan-proposals", json={"source_simulation_run_id":run["id"]}).json()
    for action in ("approve", "activate"):
        result = client.post(f"/api/plans/{proposal['id']}/actions", json={"action":action})
        assert result.status_code == 200, result.text
    session = client.post("/api/monitoring-sessions", json={"plan_version_id":proposal["id"],"simulation_run_id":run["id"]}).json()
    decision = client.post(f"/api/monitoring-sessions/{session['id']}/advance",json={"hours":24,"expected_hour":-1}).json()
    assert decision["current_hour"] == 1
    replacement = decision["pending_proposal_id"]
    for action in ("review", "approve", "activate"):
        result = client.post(f"/api/plans/{replacement}/actions", json={"action":action,"actor":"pg-operator"})
        assert result.status_code == 200, result.text
    resumed = client.post(f"/api/monitoring-sessions/{session['id']}/advance", json={"hours":1,"expected_hour":1})
    assert resumed.status_code == 200, resumed.text
    fetched = client.get(f"/api/monitoring-sessions/{session['id']}").json()
    assert fetched["current_hour"] == 2
    assert fetched["plan_version_id"] == replacement
    assert fetched["trajectory"][:2] == decision["trajectory"][:2]
    assert fetched["execution_policy"] == "generator_first_approved_missions_v1"
    assert any(event["action"] == "execution_resumed" for event in fetched["events"])
