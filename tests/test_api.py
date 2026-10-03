from __future__ import annotations

from fastapi.testclient import TestClient
import pytest

from backend.app.db import get_engine
from backend.app.main import app


def test_station_route_marks_reference_profile_synthetic(api_client: TestClient) -> None:
    client = api_client
    response = client.get("/api/station")
    assert response.status_code == 200
    assert response.json()["profile"] == "synthetic_reference_station"
    assert response.json()["configuration"]["battery"]["capacity_kwh"] == 360


@pytest.mark.parametrize(
    "origin",
    ["http://localhost:3000", "http://[::1]:3000", "http://[::1]:3001"],
)
def test_vite_dev_origin_can_preflight_simulation_post(
    api_client: TestClient, origin: str
) -> None:
    response = api_client.options(
        "/api/simulation-runs",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


def test_health_is_degraded_when_database_url_is_missing(
    api_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    get_engine.cache_clear()
    response = api_client.get("/api/health")
    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": "not_configured"}
    get_engine.cache_clear()


def test_simulation_run_is_persisted_and_retrievable_with_telemetry(api_client: TestClient) -> None:
    client = api_client
    created = client.post(
        "/api/simulation-runs",
        json={"scenario": "normal", "days": 2, "seed": 17},
    )
    assert created.status_code == 201, created.text
    run = created.json()
    assert run["summary"]["duration_hours"] == 48
    assert run["simulator_version"]

    run_id = run["id"]
    fetched = client.get(f"/api/simulation-runs/{run_id}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == run_id

    page = client.get(f"/api/simulation-runs/{run_id}/telemetry?limit=5&offset=10")
    assert page.status_code == 200
    assert page.json()["total"] == 48
    assert [row["hour"] for row in page.json()["items"]] == [10, 11, 12, 13, 14]

    events = client.get(f"/api/simulation-runs/{run_id}/events")
    missions = client.get(f"/api/simulation-runs/{run_id}/missions")
    listed = client.get("/api/simulation-runs?limit=10")
    assert events.status_code == 200
    assert missions.status_code == 200
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1



def test_unknown_run_and_invalid_scenario_inputs_are_rejected(api_client: TestClient) -> None:
    client = api_client
    missing = client.get("/api/simulation-runs/00000000-0000-0000-0000-000000000001")
    invalid = client.post("/api/simulation-runs", json={"scenario": "unknown", "days": 2})
    too_short = client.post("/api/simulation-runs", json={"scenario": "normal", "days": 1})
    assert missing.status_code == 404
    assert invalid.status_code == 422
    assert too_short.status_code == 422


def test_battery_capacity_scenario_is_executable_and_persisted(api_client: TestClient) -> None:
    response = api_client.post(
        "/api/simulation-runs",
        json={"scenario": "battery_capacity_loss", "days": 30, "seed": 21},
    )
    assert response.status_code == 201, response.text
    run = response.json()
    assert run["config_snapshot"]["station"]["battery"]["capacity_kwh"] == pytest.approx(252)
    assert run["summary"]["battery_final_kwh"] <= 252
