# Checkpoint 1 — workspace verification

Date: 3 October 2026. Status: implemented and verified, awaiting user acceptance.

## Delivered scope

The original frontend in `src/` is still the application. The separate `frontend/` draft was not edited. No migration, schema change, main-database reset or production record write was performed for this checkpoint.

- Persist a composite run/proposal/monitoring selection; changing the run clears dependent selections atomically. Restore legacy browser selections without restoring orphan dependencies.
- Validate proposal/session case and station linkage before displaying operating evidence. Missing or mismatched selections expose retry/clear-selection recovery; clearing does not delete saved records.
- Use the same telemetry cursor in the header, Overview and Assets: prepared H0 before observations, then the exact monitoring hour. Never select the final run hour as the current station state. Unknown, corrupt or missing readings remain unavailable.
- Identify the station's active plan separately from the selected proposal, including an explicit “another case” indication where needed.
- Add Settings, About and operator-entry routes while retaining all original navigation destinations. Operator profiles supply action actor labels; they do not enforce authentication or authorization.
- Persist temperature/wind units, UTC/IST time display, reduced motion and default advance step. Health diagnostics call the real local API/database check, not a modeled internet status. System motion preferences also disable chart motion.
- Remove the large overview capability card; collapse full-run summary, record IDs and methodology into contextual details. Keep provenance accessible through the station-model indicator and About. This is copy/context cleanup, not the next dashboard redesign.
- Preserve React context identity during Vite hot updates. Editing the provider previously produced a transient “FIRN context missing”; a subsequent hot update and route navigation completed without new errors after the fix.

## Automated verification

- `npm run test:workspace`: **22 passed**. Tests cover preference/profile normalization, atomic selection changes, orphan persistence, case/station linkage, exact/prepared/invalid cursors, zero/negative measurements and explicit UTC/IST formatting.
- `npx tsc --noEmit`: passed.
- ESLint on touched frontend files: zero errors; one existing Fast Refresh export warning. The context-instance hot-update issue is separately fixed and browser-retested.
- `npm run build`: client, SSR and server build passed. Existing Vite tsconfig-paths deprecation notice remains non-blocking.
- WSL backend regression: **71 passed**, one dependency deprecation warning. The opt-in `test_postgres_integration.py` suite was not rerun in this gate. Some fast API unit tests use disposable in-memory SQLite fixtures; neither application configuration nor the browser workflow was switched away from PostgreSQL.

## Browser verification

Original frontend test server: `http://localhost:3001`. Isolated real FastAPI service: `http://127.0.0.1:8001`, using the existing PostgreSQL `firn_test_db` schema at `0003_monitoring_replanning`.

`scripts/serve_phase7_test_api.py` encloses UI-test writes in an outer transaction with request savepoints. Stopping this test service rolls those writes back. It does not apply migrations or target `firn_db`. Test records are not durable rehearsal fixtures. PostgreSQL `now()` timestamps share the enclosing transaction's start time in this harness; this does not indicate frozen operating telemetry.

Checks performed through visible controls:

1. Visited all seven original destinations, Settings, About and operator entry. Created normal, two-day, seed-42 case and retrieved 48 hourly records.
2. Before monitoring, header and Overview/Assets used H0: temperature −26.6 °C, wind 30.9 km/h, battery 270 kWh and fuel 2986.9184 L. Full-run ending fuel was not shown as current inventory.
3. Saved Fahrenheit, m/s, IST, six-hour advance and reduced motion; reloaded. Header converted H0 to −16.0 °F, 8.6 m/s and 05:30 IST. Monitoring's default advance field restored six hours. Subsequently restored standard recording preferences.
4. Saved “Checkpoint Operator / Mission coordinator.” Generated, reviewed, approved and explicitly activated a proposal; the saved decision history used that actor name.
5. Started monitoring and advanced two hours from cursor −1 to H1. Header/Monitoring showed −26.1 °C, 32.6 km/h and 01:00 UTC. Overview/Assets followed the same cursor: renewable 20.8068 kW, fuel 2974.231 L and battery 270 kWh.
6. Reloaded the monitoring page and restored the same run, active proposal, session and H1. Default advance step restored from preferences rather than retaining an unsaved field edit.
7. Created another case with seed 43. Selected proposal/session cleared; the station active plan remained visible as belonging to another case. About confirmed no selected proposal and monitoring not started.
8. Stopped only the isolated test API. Reloading exposed API-unavailable state, no weather/time/readings and retry/selection recovery. Restarting rolled-back fixtures exposed “Simulation run not found”; clearing selection recovered the empty workspace without deleting records. Created a fresh seed-42 fixture afterward.
9. Opened notifications: showed the selected session with no recorded events, not seeded alerts. Opened cleaned history and contextual evidence. Final navigation after the context hot-update fix produced no new browser errors/warnings in the checked interval.

Cross-case/session mismatch guards are unit-verified; a deliberately corrupted database session was not manufactured through the browser. OS-level motion changes were not simulated; explicit reduced-motion persistence was browser-checked. Full viewport/accessibility stress review belongs to Checkpoints 2 and 6.

Screenshots:

- [Overview at H1](overview.png)
- [Monitoring after reload](monitoring.png)
- [Settings and actual diagnostics](settings.png)
- [API unavailable](offline.png)
- [Missing record recovery](missing-record.png)

## Remaining gaps and checkpoint placement

These are not silently declared implemented:

- **Checkpoint 2:** one-glance dashboard hierarchy, rounded operational values, reserve/runway/resupply context, total energy-balance charts and a compact decision queue. Current resource plots still compare renewable availability with demand, not complete supply accounting.
- **Checkpoint 3:** expose the existing forecasting/uncertainty backend capabilities in the UI, improve infeasibility diagnostics and solver-duration handling. The current Forecast route shows a saved trajectory, not a calibrated probability forecast; the API client's universal 15-second timeout still needs solver-specific treatment.
- **Checkpoint 4:** monitoring compares original scenario replay with a plan; it does not execute optimized dispatch. Replacement activation ends original playback. Continuation must be implemented and verified or explicitly remain a boundary.
- **Checkpoint 5:** modeled external uplink/outbox behavior is not implemented here. Local API/database health is real but is not evidence of external-link resilience.
- **Checkpoint 6:** matched baseline evaluation, full stress/rehearsal and final recording readiness remain unaccepted.

No cosmetic adapter, login, confidence or connectivity badge should imply those backend capabilities already exist.

## User review gate

The prepared test workspace is left at H1 for review while the isolated test API is running. Existing services on ports 3000/8000 were not stopped or reconfigured. Changes are also available through the original dev server after reload.

1. Open Overview, Assets and Monitoring; compare the header time/weather and current resource values.
2. In Settings, change a unit and timezone, save and reload. Check the profile entry and About links.
3. Inspect the compact/collapsed explanatory areas; approve this foundation or list requested revisions.

- [x] Implementation verified.
- [x] Automated and browser checks recorded.
- [ ] User accepted Checkpoint 1.

Do not proceed to Checkpoint 2 until this review is complete.
