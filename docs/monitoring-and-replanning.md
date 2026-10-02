# Monitoring and adaptive replanning

**Status:** Phase 6 simulation-only backend workflow. It replays stored synthetic telemetry; it does not connect to physical equipment or live station feeds.  
**Updated:** 2026-10-02

## Operating flow

1. Create and explicitly activate a plan version as described in `docs/plan-management.md`.
2. Create a simulation run with the same station, scenario, duration, seed, and start time used by that plan. A plan linked to a source run must monitor that run.
3. Start a monitoring session for the active plan and matching run. Its persisted clock starts at hour `-1`.
4. Advance the clock by 1–24 simulated hours. Each step reads one saved telemetry row, compares it with the active plan's dispatch/weather trajectory, evaluates alerts, and appends any resulting event.
5. A qualifying alert can create a linked `proposed` child plan from the latest observed battery, fuel, generator, and remaining-mission state. The parent plan stays `active`; a pending proposal prevents duplicate automatic proposals until an operator decides it.
6. Review, edit, approve, and activate through the existing Phase 5 plan workflow. Activation is still explicit and supersedes the former plan only after approval.

The clock advances through a completed, persisted simulator trajectory; the simulator itself is not being stepped against newly arriving observations. The monitoring API reports the latest simulated state and an actual-versus-plan comparison for weather, renewable availability, battery SOC, fuel, generator status, and mission progress.

## Trigger and guard policy

- Storm, generator failure, resupply delay, critical-load violation, and mission failure/shortfall/deferment/interruption are event-driven signals. High/critical events can propose immediately.
- Low renewable output and battery-plan deviation use a two-hour persistence check. Clear conditions must persist for two hours before the same rule can fire again.
- The initial one-hour freeze and six-hour post-proposal cooldown suppress only non-high/critical replan triggers.
- Non-high/critical proposals must improve the priority-weighted mission score by at least one point, reduce modeled fuel by at least 5%, or establish that the carry-forward schedule is infeasible. High/critical signals are safety exceptions and bypass that minimum-benefit screen; the exception is recorded in the proposal's benefit assessment.
- Only one proposed/reviewed/approved monitoring proposal may be pending per session. Monitoring history is append-only.

These are transparent prototype thresholds, not calibrated station operating limits. The `low_renewable` scenario is synthetic and exists to exercise the trigger path.

## API

| Method and path | Behavior |
|---|---|
| `POST /api/monitoring-sessions` | Start a persisted session from `{"plan_version_id": "...", "simulation_run_id": "..."}` after validating an active, matching plan/run pair. |
| `GET /api/monitoring-sessions/{session_id}` | Read the simulation clock, latest observation, actual-versus-plan comparison, pending proposal, and append-only alert/action history. |
| `POST /api/monitoring-sessions/{session_id}/advance` | Advance by `{"hours": 1}` (1–24); repeated calls continue from the persisted cursor. |

The monitoring state and events are stored in `monitoring_sessions` and `monitoring_events`. Replan proposals use `plan_versions` and `plan_events`, preserving Phase 5 version history. Alembic revision `0003_monitoring_replanning` adds only the two monitoring tables; it does not rewrite prior simulation or plan data.

## Verify

Run all automated tests from WSL:

```bash
cd /mnt/c/FIRN/firn-polar-ops
.venv-wsl/bin/python -B -m pytest -p no:cacheprovider
```

Run PostgreSQL integration against the isolated `firn_test_db` only:

```bash
.venv-wsl/bin/python -B scripts/run_postgres_integration.py
```

The script verifies the `.env` source is `firn_db`, derives `firn_test_db`, checks its owner is `firn_app`, and applies migrations there. It does not migrate `firn_db`. When deliberately preparing the application's main database later, first review the migration, confirm the configured `DATABASE_URL`, and then apply `alembic -c backend/alembic.ini upgrade head` to that explicitly chosen database.

Automated end-to-end tests cover storms, generator failure, sustained low-renewable output, delayed resupply, mission deferral, checkpoint-state replanning, hysteresis, pending-proposal suppression, and preservation of the active plan. All values and trajectories remain synthetic.

## Limitations

- Runs are precomputed. This is a controlled playback clock, not a real-time or event-by-event digital twin.
- A checkpoint replan uses the observed state and a new deterministic synthetic future trajectory. The future is not derived from actual future observations or a calibrated forecast distribution.
- Generator and mission state reconstruction follows available simulator telemetry/events; this remains a simplified model.
- Operator identity is still a caller-provided label, with no authentication/authorization layer.
- The frontend is not connected to these monitoring endpoints yet; that is Phase 7.
