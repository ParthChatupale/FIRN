from __future__ import annotations

from datetime import datetime
from dataclasses import asdict, replace

import pytest
from fastapi.testclient import TestClient

from backend.app.models import MonitoringSession, PlanVersion, SimulationRun
from backend.app.monitoring import _checkpoint_config, _update_hysteresis
from backend.simulation import SimulationEngine
from backend.simulation.scenarios import build_scenario


@pytest.mark.parametrize(
    ("hour", "ice_core_window"),
    [(1, (7, 4)), (8, (0, 4)), (10, (0, 2)), (12, None)],
    ids=["future", "starts-at-checkpoint", "in-progress", "finished"],
)
def test_checkpoint_preserves_mission_work_without_counting_waiting_time(
    hour: int, ice_core_window: tuple[int, int] | None,
) -> None:
    original = build_scenario("normal", days=2, seed=73)
    result = SimulationEngine().run(original)
    parent = PlanVersion(scenario="normal", plan_snapshot={"schedule": [
        {"mission_id": mission.id, "selected": True,
         "start_hour": mission.start_hour, "duration_hours": mission.duration_hours}
        for mission in original.station.missions
    ]})
    run = SimulationRun(
        duration_days=2, seed=73, started_at=datetime.fromisoformat(original.start_time),
        config_snapshot=asdict(original),
        event_log=result.event_log,  # Progress requires recorded execution, not an elapsed plan window.
    )

    checkpoint, baseline_starts = _checkpoint_config(parent, run, result.telemetry, hour)
    missions = {mission.id: mission for mission in checkpoint.station.missions}
    if ice_core_window is None:
        assert "ice-core" not in missions
        assert "ice-core" not in baseline_starts
    else:
        mission = missions["ice-core"]
        assert (mission.start_hour, mission.duration_hours) == ice_core_window
        assert baseline_starts[mission.id] == [ice_core_window[0]]

    # Later missions still fit; inflated waiting time previously removed these.
    for mission in original.station.missions[1:]:
        shifted = missions[mission.id]
        assert shifted.start_hour == mission.start_hour - (hour + 1)
        assert shifted.duration_hours == mission.duration_hours
        assert baseline_starts[mission.id] == [shifted.start_hour]


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
    current = client.get(f"/api/monitoring-sessions/{session_id}").json()["current_hour"]
    while current < target_hour:
        step = min(24, target_hour - current)
        response = client.post(
            f"/api/monitoring-sessions/{session_id}/advance", json={"hours": step}
        )
        assert response.status_code == 200, response.text
        result = response.json()
        current = result["current_hour"]
        if result["pending_proposal_id"] and current < target_hour:
            # Test traversal deliberately rejects earlier decisions; the browser stops for review.
            rejected = client.post(f"/api/plans/{result['pending_proposal_id']}/actions",
                                   json={"action": "reject", "actor": "test-traversal"})
            assert rejected.status_code == 200
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
        blocked = api_client.post(
            f"/api/monitoring-sessions/{monitored['id']}/advance", json={"hours": 3}
        )
        assert blocked.status_code == 409
        assert sum(event["action"] == "proposal_created" for event in monitored["events"]) == 1


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


def test_explicit_activation_continues_same_clock_and_resources(api_client):
    plan, run = _active_plan_and_run(api_client, "low_renewable")
    session = api_client.post("/api/monitoring-sessions", json={
        "plan_version_id": plan["id"], "simulation_run_id": run["id"]}).json()
    pending = api_client.post(f"/api/monitoring-sessions/{session['id']}/advance",
                              json={"hours": 24, "expected_hour": -1}).json()
    assert pending["current_hour"] == 1  # Exact decision state, not the requested batch end.
    proposal_id = pending["pending_proposal_id"]
    assert proposal_id
    proposal = api_client.get(f"/api/plans/{proposal_id}").json()
    config = proposal["plan_snapshot"]["planning_context"]["config_snapshot"]
    assert config["horizon_hours"] == 46
    assert config["station"]["battery"]["reserve_kwh"] == run["config_snapshot"]["station"]["battery"]["reserve_kwh"]
    before = pending["trajectory"][:2]
    assert api_client.post(f"/api/plans/{proposal_id}/actions", json={"action": "activate"}).status_code == 409
    for action in ("review", "approve", "activate"):
        response = api_client.post(f"/api/plans/{proposal_id}/actions",
                                   json={"action": action, "actor": "continuation-test"})
        assert response.status_code == 200, response.text
    activated = api_client.get(f"/api/monitoring-sessions/{session['id']}").json()
    assert activated["id"] == session["id"]
    assert activated["simulation_run_id"] == run["id"]
    assert activated["current_hour"] == 1
    assert activated["plan_origin_hour"] == 2
    assert activated["plan_version_id"] == proposal_id
    assert activated["pending_proposal_id"] is None
    assert activated["trajectory"][:2] == before
    assert len(activated["trajectory"]) == 48  # No padded extra day.
    assert activated["execution_policy"] == "generator_first_approved_missions_v1"
    assert activated["latest_observation"]["forecast_comparison"]["battery_delta_kwh"] is None
    resumed = api_client.post(f"/api/monitoring-sessions/{session['id']}/advance",
                              json={"hours": 1, "expected_hour": 1})
    assert resumed.status_code == 200, resumed.text
    after = resumed.json()
    assert after["current_hour"] == 2
    point = after["trajectory"][2]
    assert point["timestamp"] > before[-1]["timestamp"]
    assert point["fuel_liters"] == pytest.approx(before[-1]["fuel_liters"] - point["fuel_consumed_liters"] - point["mission_fuel_used_liters"], abs=0.001)
    assert abs(point["energy_balance_error_kw"]) < 1e-5
    window = after["trajectory"][:3]
    rate = sum(row["fuel_consumed_liters"] + row["mission_fuel_used_liters"] for row in window) / 3
    assert point["fuel_runway_hours"] == pytest.approx(round(point["fuel_liters"] / rate, 2))
    assert point["battery_kwh"] >= config["station"]["battery"]["reserve_kwh"]
    outlook = api_client.get(f"/api/simulation-runs/{run['id']}/outlook",
                            params={"origin_hour": 2, "monitoring_session_id": session["id"]})
    assert outlook.status_code == 200, outlook.text
    assert outlook.json()["forecast"]["observation_source"] == "monitoring_session"
    assert api_client.get(f"/api/simulation-runs/{run['id']}/outlook",
        params={"origin_hour": 3, "monitoring_session_id": session["id"]}).status_code == 409
    retry = api_client.post(f"/api/monitoring-sessions/{session['id']}/advance",
                            json={"hours": 1, "expected_hour": 1})
    assert retry.status_code == 409
    assert api_client.get(f"/api/plans/{plan['id']}").json()["status"] == "superseded"
    final = _advance_to(api_client, session["id"], 47)
    arrivals = [e for e in final["observed_events"] if e["kind"] == "resupply_arrived"]
    assert len(arrivals) == 1
    assert final["status"] == "completed"
    completions = [e["subject"] for e in final["observed_events"] if e["kind"] == "mission_completed"]
    assert len(completions) == len(set(completions))


def test_checkpoint_preserves_custom_station_events_and_exact_remaining_hours():
    from backend.simulation import EventKind, ScheduledEvent, ResupplyConfig
    config = build_scenario("normal", days=2, seed=51)
    config = replace(config, station=replace(config.station, solar_capacity_kw=17,
        fuel_resupply=ResupplyConfig(arrival_hour=24, fuel_liters=1234)), events=(
        ScheduledEvent("applied", EventKind.RESUPPLY_DELAY, 0, value=6),
        ScheduledEvent("future", EventKind.RESUPPLY_DELAY, 5, value=8),
        ScheduledEvent("failure", EventKind.GENERATOR_FAILURE, 0, duration_hours=10, target="gen-1"),
    ))
    result = SimulationEngine().run(config)
    parent = PlanVersion(plan_snapshot={"schedule": [
        {"mission_id": m.id, "selected": True, "start_hour": m.start_hour,
         "duration_hours": m.duration_hours} for m in config.station.missions]})
    run = SimulationRun(duration_days=2, seed=51, config_snapshot=asdict(config),
                        started_at=datetime.fromisoformat(config.start_time), event_log=result.event_log)
    checkpoint, _ = _checkpoint_config(parent, run, result.telemetry, 1)
    assert checkpoint.hours == 46
    assert checkpoint.station.solar_capacity_kw == 17
    assert checkpoint.station.fuel_resupply.arrival_hour == 28
    assert [e.id for e in checkpoint.events] == ["future", "failure"]
    assert checkpoint.events[0].hour == 3
    assert checkpoint.events[1].duration_hours == 8
    after_delivery, _ = _checkpoint_config(parent, run, result.telemetry, 39)
    assert after_delivery.station.fuel_resupply is None
    assert all(e.kind is not EventKind.RESUPPLY_DELAY for e in after_delivery.events)
    bad = [dict(row) for row in result.telemetry]
    bad[1]["battery_kwh"] = 1
    with pytest.raises(ValueError, match="reserve"):
        _checkpoint_config(parent, run, bad, 1)


def test_checkpoint_policy_retained_and_cross_origin_comparison_denied(api_client):
    run = api_client.post("/api/simulation-runs", json={"scenario":"low_renewable","days":2,"seed":73}).json()
    plan = api_client.post("/api/plan-proposals", json={"source_simulation_run_id":run["id"],"planning_mode":"robust"}).json()
    for action in ("approve", "activate"):
        assert api_client.post(f"/api/plans/{plan['id']}/actions", json={"action":action}).status_code == 200
    session = api_client.post("/api/monitoring-sessions", json={"plan_version_id":plan["id"],"simulation_run_id":run["id"]}).json()
    decision = api_client.post(f"/api/monitoring-sessions/{session['id']}/advance",json={"hours":2}).json()
    replacement = api_client.get(f"/api/plans/{decision['pending_proposal_id']}").json()
    assert replacement["plan_snapshot"]["planning_context"]["mode"] == "robust"
    assert replacement["plan_snapshot"]["uncertainty_assessment"]["mode"] == "deterministic_worst_case_envelope"
    comparison = api_client.get(f"/api/plan-groups/{plan['plan_group_id']}/compare?baseline_version=1&candidate_version=2")
    assert comparison.status_code == 404


def test_completed_work_and_in_progress_mission_fuel_are_not_repeated():
    config = build_scenario("normal", days=2, seed=51)
    first = config.station.missions[0]
    config = replace(config, station=replace(config.station, missions=(replace(first, start_hour=0,
        duration_hours=4, non_electric_fuel_l=25),)))
    result = SimulationEngine().run(config)
    parent = PlanVersion(plan_snapshot={"schedule":[{"mission_id":first.id,"selected":True,"start_hour":0,"duration_hours":4}]})
    run = SimulationRun(duration_days=2, seed=51, config_snapshot=asdict(config),
                        started_at=datetime.fromisoformat(config.start_time), event_log=result.event_log)
    halfway, _ = _checkpoint_config(parent, run, result.telemetry, 1)
    assert halfway.station.missions[0].duration_hours == 2
    assert halfway.station.missions[0].non_electric_fuel_l == 0
    finished, _ = _checkpoint_config(parent, run, result.telemetry, 3)
    assert finished.station.missions == ()


def test_elapsed_planned_window_does_not_complete_unobserved_work():
    config = build_scenario("normal", days=2, seed=51)
    mission = replace(config.station.missions[0], start_hour=12, non_electric_fuel_l=25)
    config = replace(config, station=replace(config.station, missions=(mission,)))
    result = SimulationEngine().run(config)
    parent = PlanVersion(plan_snapshot={"schedule": [{"mission_id": mission.id,
        "selected": True, "start_hour": 0, "duration_hours": 4}]})
    run = SimulationRun(duration_days=2, seed=51, config_snapshot=asdict(config),
                        started_at=datetime.fromisoformat(config.start_time), event_log=result.event_log)
    remaining, baseline = _checkpoint_config(parent, run, result.telemetry, 5)
    assert remaining.station.missions[0].duration_hours == 4
    assert remaining.station.missions[0].non_electric_fuel_l == 25
    assert baseline[mission.id] == [0]
    parent.plan_snapshot["schedule"][0]["selected"] = False
    remaining, baseline = _checkpoint_config(parent, run, result.telemetry, 5)
    assert remaining.station.missions[0].id == mission.id
    assert baseline[mission.id] == []  # Deferred work remains eligible, not falsely completed.


def test_multiple_checkpoint_activations_preserve_history_and_remaining_work(api_client):
    plan, run = _active_plan_and_run(api_client, "storm")
    session = api_client.post("/api/monitoring-sessions", json={
        "plan_version_id": plan["id"], "simulation_run_id": run["id"]}).json()
    current = _advance_to(api_client, session["id"], 40)
    previous_plan = plan["id"]
    for hour in (40, 41):
        assert current["current_hour"] == hour
        proposal_id = current["pending_proposal_id"]
        assert proposal_id
        before = current["trajectory"][:hour + 1]
        proposal = api_client.get(f"/api/plans/{proposal_id}").json()
        assert proposal["parent_version_id"] == previous_plan
        remaining = proposal["plan_snapshot"]["planning_context"]["config_snapshot"]["station"]["missions"]
        assert [m["id"] for m in remaining] == ["storm-field-survey"]
        for action in ("review", "approve", "activate"):
            response = api_client.post(f"/api/plans/{proposal_id}/actions", json={"action": action})
            assert response.status_code == 200, response.text
        activated = api_client.get(f"/api/monitoring-sessions/{session['id']}").json()
        assert activated["trajectory"][:hour + 1] == before
        assert activated["plan_origin_hour"] == hour + 1
        assert len(activated["trajectory"]) == 48
        previous_plan = proposal_id
        current = api_client.post(f"/api/monitoring-sessions/{session['id']}/advance",
                                 json={"hours": 1, "expected_hour": hour}).json()
    assert current["current_hour"] == 42
    assert [row["hour"] for row in current["trajectory"]] == list(range(48))
    assert len([e for e in current["events"] if e["action"] == "execution_resumed"]) == 2
