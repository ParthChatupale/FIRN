# Checkpoints 2–3: implementation and review

Date: 2026-10-03. Status: implemented; verification coverage recorded below; user acceptance pending. The user authorized these two checkpoints together. Work remains in the original `src/` application; the separate `frontend/` draft was not developed or removed.

## Delivered scope

- Operations replaces the oversized lifecycle/feature-card layout with current-hour battery margin, fuel runway, resupply countdown, mission delivery, a compact status strip, aligned power/battery/fuel charts, mission lanes and linked next actions. Full-run totals and IDs are contextual details.
- Projected case means the saved simulator replay, not optimizer dispatch or a live weather forecast. Observed history is limited to the monitoring cursor; a prepared H0 snapshot is explicitly identified. Before clock advancement, an empty or one-point history has an explanation instead of tall empty charts. Mission completion counts only completion events through the cursor.
- Supply includes renewables, generator output and battery discharge. Reserve/resupply annotations, unit labels, numerical tables and asset/weather details are available. Missing measurements stay unavailable. Fuel runway is a modeled recent-consumption estimate, not a calibrated survival prediction.
- Look ahead exposes nominal, low-renewable and storm alternatives through the real API, retaining saved station/events/resupply configuration. Separate point baselines use only observations through the requested origin. There is no fabricated probability band.
- Mission Planner passes real weather-policy inputs to the optimizer, aligns mission lanes with dispatch, exposes selectable weather/resource restrictions, retains saved configuration identity, and returns targeted no-go diagnostics. Requested timing edits cannot silently drop selected work. Prior records survive failed edits.
- Proposal and timing-edit retries use request UUIDs and PostgreSQL transaction locks to avoid duplicate versions. Longer solver requests have a separate 120-second transport deadline and explicit recovery messages. The ordinary API deadline remains bounded.
- Review, approval and activation remain explicit operator actions. Selected and active plans are distinct; version comparison rejects mismatched origins/cases/horizons. Late asynchronous completion cannot attach a previous case's plan/session to a newly selected case.

## Automated verification

| Check | Result |
|---|---|
| `npm run test:ui` | 38 passed: context, metric/source calculations, comparison compatibility, pending-action routing, transport timeout/error recovery and persisted proposal inputs. |
| `.venv-wsl/bin/python -B -m pytest tests --ignore=tests/test_postgres_integration.py -q` | 80 passed, including optimizer, outlook, saved configuration, no-go, lifecycle and monitoring regressions. Dispatch tests verify modeled demand decomposition and supply = demand + charge + curtailment. |
| PostgreSQL integration suite, explicitly targeting `firn_test_db` | 3 passed; real outlook, robust proposal/configuration identity, idempotent proposal/edit retry and lifecycle paths. |
| `npx tsc --noEmit` | Passed. |
| Scoped ESLint on changed frontend modules | No errors. The existing context module retains a Fast Refresh export warning. |
| `npm run build` | Client, SSR and server builds passed. Existing Vite tsconfig-paths deprecation notice remains. |

No schema migration, production-data reset or credential change was performed. Integration tests use rollback isolation. Browser writes used `scripts/serve_phase7_test_api.py`: the existing PostgreSQL test schema at `0003_monitoring_replanning`, an outer rollback transaction and request savepoints. UI fixtures disappear when that isolated service stops; they are not durable application records. PostgreSQL transaction timestamps in this harness share its transaction-start time.

## Browser verification performed

Review service: frontend `http://localhost:3001`, isolated API `http://127.0.0.1:8001`. The user's services on ports 3000/8000 were not stopped or reconfigured.

1. Created normal / 2 days / seed 51 through Scenario Simulator. At prepared H0, weather was −25.4 °C / 42.3 km/h, demand and total supply 65.7 kW, renewable output 27 kW, generators 38.7 kW, battery 270 kWh and fuel 2,989.2 L. The displayed 180 kWh margin matches the configured 90 kWh reserve. Resupply is H47, not an invented date.
2. Checked no-proposal, prepared, active-plan and unavailable states. Inspected asset/weather details and hourly supply components. Unknown mission scheduling says not planned, not a fabricated zero completion score.
3. Switched full-horizon alternatives in Look ahead. Nominal versus low-renewable versus storm changed the actual resource trajectories and mission outcomes; the storm alternative completed fewer missions. Shared configuration/events/resupply were retained. This is a matched-opening-state comparison, not a continuation from current resources.
4. Generated a robust three-case-envelope proposal: 3 of 4 missions selected; field survey excluded by weather eligibility. Inspected weather/resource restrictions, including through clickable scheduled mission labels and the dropdown for excluded missions.
5. Changed ice-core from H6 to H7, creating a persisted child version. Comparison showed the timing change and zero objective/replay improvement, rather than inventing savings. The excluded survey retained its parent weather explanation.
6. Tried an out-of-horizon edit and a storm-envelope-ineligible H30 edit. Both rejected; the structured H30 result identified requested work that would be dropped. The prior version remained selected and unchanged.
7. Recorded review, approved, explicitly activated, and reloaded. Active status and planning controls persisted. Selecting an older proposal did not automatically replace the active version.
8. In a previous rollback fixture, started case playback and advanced two observations from cursor −1 to H1. Operations/header matched the H1 weather and resources; history showed H0–H1 only and no completed missions before their completion events.
9. Verified desktop core information at 1440 × 900 and 1920 × 1080; status, metrics, charts, mission context and next decision fit in the initial view. At 390 × 844, content reflowed vertically without horizontal page overflow. These are viewport checks, not a claim of complete accessibility certification.
10. Stopped only the isolated API. The UI showed unavailable readings and blocked workflow actions, not a green engine-online state. Restarted the test service and prepared a new review fixture through the UI.

Screenshots: [Operations, 1440](operations-1440.png), [Operations, 1920](operations-1920.png), [narrow reflow](operations-narrow.png), [Look ahead](look-ahead.png), [planning](planning.png), [no-go](no-go.png), [actual API unavailability](offline.png). Screenshots cover several rollback fixture versions; they are not all one uninterrupted monitoring session.

## Remaining boundaries and review gaps

- Checkpoint 4 is not complete. Monitoring replays stored scenario telemetry; it does not execute optimizer dispatch. Replacement activation does not establish safe continuation of the old session.
- `_checkpoint_config` still reconstructs default scenario configuration. Carrying saved station identity, parent weather policy and remaining state into checkpoint replanning belongs to Checkpoint 4, with explicit regression tests. Initial proposals/timing edits were fixed here; that does not fix all replanning paths.
- An alert-generating Operations case was not manually rehearsed in this pass. Backend alert tests and pending-checkpoint action-routing tests pass; the complete alert-to-revision browser story is still required in Checkpoint 4/6.
- Transport timeout and retry recovery are tested automatically. A deliberately stalled 120-second browser solver call was not manually forced.
- Saved older proposals may lack demand fields. Their demand remains unavailable; a newly generated proposal has the verified modeled demand fields.
- Model restrictions are configuration values, not measured station limits. Some indoor tasks currently have a permissive 10,000 km/h wind threshold; that is not a physically validated capability claim. Review model-policy presentation before recording.
- No calibrated external-data forecasting, production authentication, real sensor control, external-uplink/outbox synchronization or stress-test completion is claimed by this delivery.

## User review gate

Open Operations at `http://localhost:3001/`, then Look ahead and Mission Planner. Review the compact desktop hierarchy and scenario consequences. In Planner inspect the robust policy, mission restrictions, dispatch values and active/proposed distinction. Use Scenario Simulator to prepare another case if desired; clearing selection does not delete records.

Record acceptance or requested changes for Checkpoints 2 and 3 separately before beginning Checkpoint 4. The isolated review service is temporary; normal application startup and durable records continue to use the configured PostgreSQL application service.
