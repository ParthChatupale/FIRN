from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app.models import MonitoringSession
from backend.app.monitoring import _update_hysteresis


def _active_plan_and_run(client: TestClient, scenario: str) -> tuple[dict, dict]:
    created_run = client.post(
        "/api/simulation-runs",
        json={"scenario": scenario, "days": 2, "seed": 73},
    )
    assert created_run.status_code == 201, created_run.text
    run = created_run.json()
    created_plan = client.post(
        "/api/plan-proposals",
        json={
            "source_simulation_run_id": run["id"],
            "flexibility_hours": 4,
        },
    )
    assert created_plan.status_code == 201, created_plan.text
    plan = created_plan.json()
    for action in ("approve", "activate"):
        response = client.post(
            f"/api/plans/{plan['id']}/actions",
            json={"action": action, "actor": "phase6-test"},
        )
        assert response.status_code == 200, response.text
    return client.get(f"/api/plans/{plan['id']}").json(), run


def _advance_to(client: TestClient, session_id: str, target_hour: int) -> dict:
    result = None
    remaining = target_hour + 1  # The persisted simulation clock starts at hour -1.
    while remaining:
        step = min(24, remaining)
        response = client.post(
            f"/api/monitoring-sessions/{session_id}/advance", json={"hours": step}
        )
        assert response.status_code == 200, response.text
        result = response.json()
        remaining -= step
    assert result is not None
    return result


@pytest.mark.parametrize(
    ("scenario", "target_hour", "expected_rule"),
    [
        ("storm", 40, "storm"),
        ("generator_failure", 44, "generator_failure"),
        ("low_renewable", 1, "low_renewable_output"),
        ("resupply_delay", 0, "resupply_delay"),
    ],
)
def test_disruptions_create_checkpoint_replan_without_replacing_active_plan(
    api_client: TestClient,
    scenario: str,
    target_hour: int,
    expected_rule: str,
) -> None:
    plan, run = _active_plan_and_run(api_client, scenario)
    created = api_client.post(
        "/api/monitoring-sessions",
        json={"plan_version_id": plan["id"], "simulation_run_id": run["id"]},
    )
    assert created.status_code == 201, created.text

    monitored = _advance_to(api_client, created.json()["id"], target_hour)
    triggered = [event for event in monitored["events"] if event["rule"] == expected_rule]
    assert triggered, monitored["events"]
    proposal_events = [event for event in monitored["events"] if event["action"] == "proposal_created"]
    assert proposal_events, [
        {"action": event["action"], "observation": event["observation"]}
        for event in triggered
    ]

    active_after = api_client.get(f"/api/plans/{plan['id']}").json()
    assert active_after["status"] == "active"
    proposed = api_client.get(
        f"/api/plans/{proposal_events[0]['proposal_plan_version_id']}"
    ).json()
    assert proposed["status"] == "proposed"
    assert proposed["parent_version_id"] == plan["id"]
    assert proposed["source_simulation_run_id"] == run["id"]
    checkpoint = proposed["plan_snapshot"]["monitoring_replan"]
    assert checkpoint["checkpoint_hour"] == proposal_events[0]["hour"]
    assert checkpoint["starting_state"]["battery_kwh"] == pytest.approx(
        monitored["latest_observation"]["battery_kwh"]
    )
    assert checkpoint["forecast_policy"].startswith("new deterministic synthetic trajectory")
    if scenario == "low_renewable":
        more = api_client.post(
            f"/api/monitoring-sessions/{monitored['id']}/advance", json={"hours": 3}
        ).json()
        assert sum(event["action"] == "proposal_created" for event in more["events"]) == 1


def test_monitoring_clock_reports_actual_vs_plan_and_detects_mission_response(
    api_client: TestClient,
) -> None:
    plan, run = _active_plan_and_run(api_client, "storm")
    created = api_client.post(
        "/api/monitoring-sessions",
        json={"plan_version_id": plan["id"], "simulation_run_id": run["id"]},
    )
    session_id = created.json()["id"]
    monitored = _advance_to(api_client, session_id, 42)
    assert monitored["current_hour"] == 42
    observation = monitored["latest_observation"]
    assert observation["weather"]["regime"] == "storm"
    assert "forecast_comparison" in observation
    assert "generator_status" in observation
    assert "mission_progress" in observation
    assert "forecast_temperature_c" in observation["weather"]
    assert any(event["rule"] == "mission_deferred" for event in monitored["events"])


def test_soft_monitor_alert_uses_hysteresis_and_resets_after_two_clear_hours() -> None:
    session = MonitoringSession(alert_state={})
    signal = {"rule": "low_fuel_runway", "severity": "medium"}
    assert _update_hysteresis(session, [signal], 0) == []
    assert _update_hysteresis(session, [signal], 1) == [signal]
    assert _update_hysteresis(session, [signal], 2) == []
    assert _update_hysteresis(session, [], 3) == []
    assert _update_hysteresis(session, [], 4) == []
    assert _update_hysteresis(session, [signal], 5) == []
    assert _update_hysteresis(session, [signal], 6) == [signal]


def test_monitoring_requires_active_matching_plan_and_is_advanceable_in_bounded_steps(
    api_client: TestClient,
) -> None:
    run_response = api_client.post(
        "/api/simulation-runs", json={"scenario": "normal", "days": 2, "seed": 8}
    )
    run = run_response.json()
    proposal = api_client.post(
        "/api/plan-proposals", json={"source_simulation_run_id": run["id"]}
    ).json()
    denied = api_client.post(
        "/api/monitoring-sessions",
        json={"plan_version_id": proposal["id"], "simulation_run_id": run["id"]},
    )
    assert denied.status_code == 409

    active, _ = _active_plan_and_run(api_client, "normal")
    created = api_client.post(
        "/api/monitoring-sessions",
        json={"plan_version_id": active["id"], "simulation_run_id": run["id"]},
    )
    assert created.status_code == 409  # seed/source context does not match
    assert api_client.post(
        "/api/monitoring-sessions/00000000-0000-0000-0000-000000000000/advance",
        json={"hours": 25},
    ).status_code == 422
