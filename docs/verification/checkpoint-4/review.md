# Checkpoint 4 — monitoring, operator decisions and continuation

Date: 2026-10-03. Implementation and verification complete within the boundaries below. User acceptance remains pending. Checkpoint 5 is not started.

## Delivered

- Original `src/` frontend and existing FastAPI/PostgreSQL workflow retained. The separate `frontend/` draft is unchanged.
- Operations shows current served/demand power, renewables/generators, protected battery margin, recent-rate fuel runway, resupply, observed mission delivery, active conditions and the next operator action at the shared observation hour. Unknown readings do not become zero; monitoring not started does not become a healthy alert count.
- Monitoring puts the clock, deviations and replacement decision together. At H0 a compact comparison table replaces three oversized single-dot plots. Later observations build real saved history, with numeric absolute-hour axes and a revision-origin marker. No fabricated oscillation: generator-first dispatch can legitimately keep the battery flat.
- Review, approval and activation remain separate. A batch stops at an actionable checkpoint; further advancement is blocked until activation or rejection. The old plan stays active until explicit activation succeeds.
- A replacement carries battery, fuel, generator operating state, saved hardware/reserve configuration, declared weather-planning policy, remaining work and disruptions/resupply. Exact remaining hours avoid padded days. Completed work requires recorded completion; an expired planned window does not prove execution. Unstarted/deferred work remains eligible, and in-progress mission fuel is not charged twice.
- Same session/root run, retained observation prefix and absolute clock across repeated revisions. New dispatch references start at the revision origin, never retroactively explaining older readings. Fuel runway keeps its pre-revision consumption window.
- Active conditions are separate from event history, including sustained faults and clear hysteresis. Rejected proposals no longer leave a blocking pointer. Optional `expected_hour` rejects stale/double advancement.
- Decision Log displays parent/child lineage, persisted operator actions, observed event history and a working source filter. Look-ahead numeric baselines use the continued observation prefix; full-opening-state alternatives retain their separate meaning.

## Execution boundary

Policy: **`generator_first_approved_missions_v1`**. Approved remaining mission timings are executed by the existing simulator's generator-first energy dispatch. This is **not MILP dispatch execution**, a live digital twin, calibrated weather forecasting, hardware control or safety certification. Initial monitoring remains the original saved replay; a continuation is precomputed at explicit replacement activation.

The existing session JSONB state stores branch inputs, history, trajectory and events. The source run/telemetry is immutable. Activation checks checkpoint linkage/current hour, opening resources, exact remaining horizon, energy balance, battery reserve/capacity and fuel bounds, then commits continuation and replacement together. Timing edits of checkpoint versions remain unavailable instead of stripping their metadata. Older checkpoint proposals lacking continuation metadata fail explicitly; they are not silently upgraded.

Candidate versus carry-forward results use the same remaining inputs, planning-weather policy and horizon. They are modeled comparisons, not measured savings. An infeasible baseline does not produce a saving percentage. A high-severity trigger can request review even when modeled benefit is equal.

## Automated verification

| Check | Result |
|---|---|
| Backend suite excluding explicit PostgreSQL integration | 86 passed. Includes existing simulation, forecast, optimizer, lifecycle and API regressions. |
| Monitoring-specific suite | 17 passed. Exact pause/origin, repeated activation, saved config/policy, completed/in-progress/unobserved/deferred work, fuel continuity, future-origin rejection, duplicate advancement and end-of-horizon delivery checks. |
| `npm run test:ui` | 41 passed. Includes human-readable states, actionable pending status and absolute-origin comparison alignment. |
| PostgreSQL integration, restricted to existing `firn_test_db` | 4 passed, including persisted carried-state continuation and activation history. Additional browser rehearsal below exercised the final code against the same real PostgreSQL schema. |
| `npx tsc --noEmit` and scoped ESLint | Passed, no errors on checkpoint changes. |
| `npm run build` | Client/SSR/server production builds passed. |
| `git diff --check` | Passed; existing LF/CRLF notices only. |

Existing non-blocking notices: FastAPI test-client/httpx deprecation and Vite tsconfig-paths plugin deprecation. SQLite remains only the fast in-memory regression fixture; application and PostgreSQL integration/rehearsal use PostgreSQL.

No migration, DDL, production-data reset, credential change or Git reset was performed. The user's services on 3000/8000 were left alone. Browser writes use `scripts/serve_phase7_test_api.py`, port 8001, existing schema `0003_monitoring_replanning`, outer rollback transaction and request savepoints. These are temporary rehearsal records: they disappear when that service stops. The test harness's transaction-time audit timestamps can match; this does not mean operational time is frozen.

Stop the isolated API before rerunning PostgreSQL integration tests: its open rollback transaction can hold station-plan index locks against concurrent test inserts. Stopping it rolls back only its rehearsal transaction, not the application's main data.

## Browser verification

Frontend `http://localhost:3001`, isolated API `http://127.0.0.1:8001`. Storm / 2 days / seed 73 / saved-weather policy / ±12-hour flexibility.

1. Generated a proposal through the UI, recorded review, approved and separately activated v1. Started its observation session. At H0, verified the compact table, weather/time, resource readings and human mission statuses.
2. Advanced to H24, then requested 24 more hours. Playback stopped **at H40**, not H47. Storm: −29.2 °C / 106.1 km/h, battery 270 kWh, fuel 2,565 L. The current plan remained v1; v2 awaited human action and Advance was disabled.
3. Inspected v2's H41–H47 / seven-hour comparison, carried resources and remaining storm-field-survey decision. Weather limits prevented selection. Candidate/carry-forward modeled fuel both read 134 L and priority score both 0: no improvement percentage was invented.
4. Reviewed, approved and explicitly activated v2. H40 readings did not reset. Advanced again; a newly matured low-renewable condition stopped at H41 and created v3. A high-severity trigger bypasses the soft cooldown by existing policy, not timer-driven UI motion.
5. Reviewed/approved/activated v3 and advanced three hours to **H44**. Header and Monitoring matched: −32.7 °C / 105.9 km/h, 270 kWh battery, 2,489.1 L fuel, 69.8/69.8 kW served/demand and zero renewables. The same session retained H0–H44 history and both activation records.
6. Reloaded. v3/H44/history restored. Operations showed the same readings, 180 kWh above the 90 kWh reserve, recent-rate runway, four observed completed missions and the correct shortened plan H42–H47. Look-ahead used origin H44 / 45 observations. Decision Log showed v1/v2 superseded and v3 active; its Monitoring decisions filter removed station events/operator records.
7. Reviewed 1440×900 and 1920×1080 desktop layouts, and 390×844 narrow reflow. Narrow/wide DOM scroll width matched client width (no horizontal page overflow). Vertical reflow/scrolling remains expected at narrow widths. Event history scrolls within its panel; core desktop clock/resources/approval are visible together. A temporary viewport override was reset afterward.

Rehearsal identities (temporary, not main-database records): run `abb696a3-c0ac-4da2-bf2e-27cd68a652c7`; session `cdb151ce-ff4a-40ea-9f03-a5ac98d90798`; plan group `7bc67d7f-661e-47cc-958e-3e34d4c1d485`; v3 `7b00ee72-6c41-40eb-a208-1c3269974ca4`.

## Screenshots

- [H0 compact observation](h0-monitoring.png)
- [H40 storm / operator decision](storm-checkpoint.png)
- [Restored continued monitoring](continued-monitoring.png)
- [Operations at H44](operations-h44.png)
- [Filtered decision history and identities](decision-history.png)
- [Monitoring narrow](monitoring-narrow.png), [Monitoring wide](monitoring-wide.png)

## Your manual acceptance check

1. Restart your backend to load the changes; no migration is required. Open the original frontend. Either inspect the isolated prepared case while its test service remains running, or create **Severe Storm / 2 days / seed 73** on your normal services.
2. In Mission Planner use **Saved case weather**, generate, **Record review → Approve → Activate**. In Monitoring start playback; advance in 24-hour batches until H40. The storm proposal must pause advancement while v1 remains active.
3. Inspect the remaining-horizon decision, **Review → Approve → Activate**, then advance. A second high-severity checkpoint at H41 is expected in this case; decide it explicitly, then continue to H44. Refresh and compare Operations/Monitoring/Decision Log.
4. Confirm the compact H0 state, readable mission states, matched resources/time, completed-work retention, approval visibility and chart layout are suitable for your recording. Accept this gate or request adjustments before Checkpoint 5.

Manual rejection/error recovery and a 30-day solver load were not rehearsed here; rejection/error paths have automated coverage, and the full stress/evaluation matrix remains Checkpoint 6/Phase 8. This record does not claim all future roadmap work is complete.
