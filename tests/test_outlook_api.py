from dataclasses import asdict
from uuid import UUID, uuid4
import pytest
from backend.app.case_config import restore_config, fingerprint
from backend.app.db import get_db
from backend.app.main import app
from backend.app.models import SimulationRun
from backend.app.outlook import case_outlook
from backend.simulation import SimulationEngine
from backend.simulation.scenarios import build_scenario

def saved_case(client, scenario="normal"):
    response = client.post("/api/simulation-runs", json={"scenario": scenario, "days": 2, "seed": 51})
    assert response.status_code == 201, response.text
    return response.json()

def test_saved_configuration_roundtrip_and_fingerprint():
    config = build_scenario("resupply_delay", days=14, seed=15)
    assert asdict(restore_config(asdict(config))) == asdict(config)
    assert fingerprint(config) == fingerprint(restore_config(asdict(config)))
    with pytest.raises(ValueError, match="cannot be reconstructed"):
        restore_config({"station": {}})

def test_outlook_contract_and_origin_validation(api_client):
    run = saved_case(api_client)
    response = api_client.get(f"/api/simulation-runs/{run['id']}/outlook?origin_hour=25")
    assert response.status_code == 200, response.text
    outlook = response.json()
    assert outlook["forecast"]["training_hours"] == 26
    assert outlook["forecast"]["method"] == "seasonal_naive"
    assert [p["hour"] for p in outlook["forecast"]["points"]] == list(range(26, 50))
    assert [c["name"] for c in outlook["cases"]] == ["nominal", "low_renewable", "storm"]
    assert all(len(c["telemetry"]) == 48 for c in outlook["cases"])
    assert outlook["assumptions"]["probabilistic"] is False
    assert outlook["assumptions"]["config"] == run["config_snapshot"]
    assert api_client.get(f"/api/simulation-runs/{run['id']}/outlook?origin_hour=48").status_code == 422
    assert api_client.get(f"/api/simulation-runs/{uuid4()}/outlook").status_code == 404

def test_forecast_does_not_leak_future_and_requires_contiguous_training():
    config = build_scenario("normal", days=2, seed=51)
    result = SimulationEngine().run(config)
    run = SimulationRun(id=uuid4(), config_snapshot=asdict(config))
    baseline = case_outlook(run, result.telemetry, 12, 6)
    changed = [{**p, "demand_kw": 99999, "renewable_kw": 0} if p["hour"] > 12 else p for p in result.telemetry]
    assert case_outlook(run, changed, 12, 6)["forecast"] == baseline["forecast"]
    with pytest.raises(ValueError, match="contiguous"):
        case_outlook(run, result.telemetry[1:], 12, 6)

def test_proposal_retry_is_idempotent_and_rejects_changed_inputs(api_client):
    run = saved_case(api_client)
    payload = {"source_simulation_run_id": run["id"], "request_id": str(uuid4()), "planning_mode": "nominal"}
    first = api_client.post("/api/plan-proposals", json=payload)
    assert first.status_code == 201, first.text
    retry = api_client.post("/api/plan-proposals", json=payload)
    assert retry.json()["id"] == first.json()["id"]
    assert len(api_client.get("/api/plans").json()["items"]) == 1
    for changes in [{"seed": 999}, {"days": 7}, {"planning_mode": "adverse"}, {"flexibility_hours": 5}]:
        assert api_client.post("/api/plan-proposals", json={**payload, **changes}).status_code == 409

def test_custom_saved_inputs_are_preserved_by_proposal_and_edit(api_client):
    run = saved_case(api_client)
    snapshot = run["config_snapshot"]
    snapshot["station"]["initial_fuel_liters"] = 4200
    snapshot["station"]["battery"]["reserve_kwh"] = 100
    generator = app.dependency_overrides[get_db]()
    db = next(generator)
    try:
        db.get(SimulationRun, UUID(run["id"])).config_snapshot = snapshot
        db.commit()
    finally:
        generator.close()
    created = api_client.post("/api/plan-proposals", json={"source_simulation_run_id": run["id"], "planning_mode": "nominal"})
    assert created.status_code == 201, created.text
    plan = created.json()
    assert plan["plan_snapshot"]["planning_context"]["config_snapshot"] == snapshot
    mission = next(m for m in plan["plan_snapshot"]["schedule"] if m["mission_id"] == "ice-core" and m["selected"])
    edited = api_client.post(f"/api/plans/{plan['id']}/edits", json={"mission_start_hours": {"ice-core": mission["start_hour"] + 1}})
    assert edited.status_code == 201, edited.text
    assert edited.json()["plan_snapshot"]["planning_context"]["config_fingerprint"] == plan["plan_snapshot"]["planning_context"]["config_fingerprint"]
    assert edited.json()["plan_snapshot"]["planning_context"]["mode"] == "nominal"

def test_real_robust_weather_envelope_is_returned(api_client):
    run = saved_case(api_client)
    response = api_client.post("/api/plan-proposals", json={"source_simulation_run_id": run["id"], "planning_mode": "robust"})
    assert response.status_code == 201, response.text
    snapshot = response.json()["plan_snapshot"]
    assert snapshot["planning_context"]["mode"] == "robust"
    assert snapshot["uncertainty_assessment"]["mode"] == "deterministic_worst_case_envelope"
    assert set(snapshot["uncertainty_assessment"]["scenario_names"]) == {"nominal", "low_renewable", "storm"}

def test_no_go_keeps_previous_version_and_returns_diagnostics(api_client):
    previous = api_client.post("/api/plan-proposals", json={"scenario": "normal", "days": 2, "seed": 51}).json()
    run = saved_case(api_client)
    snapshot = run["config_snapshot"]
    snapshot["station"]["loads"]["critical_kw"] = 1000
    generator = app.dependency_overrides[get_db]()
    db = next(generator)
    try:
        db.get(SimulationRun, UUID(run["id"])).config_snapshot = snapshot
        db.commit()
    finally:
        generator.close()
    response = api_client.post("/api/plan-proposals", json={"source_simulation_run_id": run["id"]})
    assert response.status_code == 422, response.text
    assert response.json()["detail"]["code"] == "infeasible"
    assert response.json()["detail"]["diagnostics"]["likely_power_bottlenecks"]
    assert api_client.get(f"/api/plans/{previous['id']}").json() == previous
    assert len(api_client.get("/api/plans").json()["items"]) == 1

def test_robust_edit_preserves_deferred_reason_and_no_go_cannot_create_version(api_client):
    run = saved_case(api_client)
    parent = api_client.post("/api/plan-proposals", json={"source_simulation_run_id": run["id"], "planning_mode": "robust"}).json()
    mission = next(m for m in parent["plan_snapshot"]["schedule"] if m["mission_id"] == "ice-core")
    response = api_client.post(f"/api/plans/{parent['id']}/edits", json={"mission_start_hours": {"ice-core": mission["start_hour"] + 1}})
    assert response.status_code == 201, response.text
    child = response.json()
    deferred = next(m for m in child["plan_snapshot"]["schedule"] if m["mission_id"] == "field-survey")
    assert "Retained parent selection" in deferred["reason"]
    blocked = api_client.post(f"/api/plans/{child['id']}/edits", json={"mission_start_hours": {"ice-core": 30}})
    assert blocked.status_code == 422, blocked.text
    assert blocked.json()["detail"]["diagnostics"]["missions_not_retained"] == ["ice-core"]
    versions = api_client.get(f"/api/plan-groups/{child['plan_group_id']}/versions").json()["items"]
    assert len(versions) == 2
    assert api_client.get(f"/api/plans/{child['id']}").json() == child

def test_timing_edit_retry_creates_only_one_version(api_client):
    parent = api_client.post("/api/plan-proposals", json={"scenario": "normal", "days": 2, "seed": 51}).json()
    mission = next(m for m in parent["plan_snapshot"]["schedule"] if m["mission_id"] == "ice-core")
    payload = {"mission_start_hours": {"ice-core": mission["start_hour"] + 1}, "request_id": str(uuid4())}
    endpoint = f"/api/plans/{parent['id']}/edits?actor=operator-test"
    child = api_client.post(endpoint, json=payload)
    assert child.status_code == 201, child.text
    retry = api_client.post(endpoint, json=payload)
    assert retry.json()["id"] == child.json()["id"]
    conflict = api_client.post(endpoint, json={**payload, "mission_start_hours": {"ice-core": mission["start_hour"] + 2}})
    assert conflict.status_code == 409
    assert len(api_client.get(f"/api/plan-groups/{parent['plan_group_id']}/versions").json()["items"]) == 2
