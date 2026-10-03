# Rehearsal corrections verification — 3 October 2026

Scope: browser-local presentation workflow in the original app. No backend, database migration or physical integration work. This supersedes the prior recording verification for the revised sequence, without deleting its historical screenshots.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run test:presentation` | 35 passed: 17 station-model and 18 workflow/source-wiring tests |
| `npm run test:ui` | 41 passed: retained connected-UI model/transport regression tests |
| `npx tsc --noEmit` | Passed |
| Scoped ESLint on changed TS/TSX | 0 errors; 2 existing mixed-export Fast Refresh warnings |
| `npm run build` | Client, SSR and server production build passed |
| `npm run recording:export` | Regenerated schema 3, fifteen logical checkpoints |
| `git diff --check` | Passed; normal Windows line-ending notices only |

Workflow tests cover baseline/applied alignment, minimum preparation before publication, duplicate/stale/canceled tasks, acknowledgement during preparation, interrupted refresh/retry, retained published outlook, condition resolution/history, mild-weather and past-conflict predicates, separate asset assessment, no-go and connectivity clocks. The source-wiring test checks sole authorization placement and defaults; it does not test rendered browser interaction.

Existing login/settings and two representative backend source hashes match the start-of-task values. Git changes are confined to recording UI/workflow, tests/export script, package test command and associated documentation. No backend migrations, service configuration or PostgreSQL writes were performed.

## Reconciled outcome

The [export](../recording-case/data.json) derives values from the same pure engine/workflow as the UI, not copied outcome cards. The exporter completes preparation logically by providing the configured elapsed interval; it does not measure browser latency.

| Point | Active plan | Battery / fuel now | Nominal fuel before delivery |
| --- | --- | --- | --- |
| Baseline H0 | V1 | 312 kWh / 1,650 L | 1,403 L |
| Inputs received, forecast preparing | V1 | Unchanged | Published baseline retained |
| Revised forecast ready | V1 | Unchanged | 856 L |
| First joint response active | V2 | Unchanged | 805 L |
| Weather observed H24 | V2 | 340 kWh / 1,526 L | 805 L |
| Generator observed H26 | V2, assessment first | 340 kWh / 1,498 L | 740 L |
| Remaining-work revision active | V3 | Unchanged at activation | 765 L |
| Continued execution H48 | V3 | 240 kWh / 1,170 L | 765 L |

The selected branch delivers five missions and defers one. Exact modeled link-loss branch queues five records, then clears them only on explicit external acknowledgement. These are conditional modeled outcomes, not certified operational guarantees. The script and model notes distinguish arrival fuel, matched-horizon consumption and current inventory.

## Browser limitation

The computer-use tool explicitly denied the localhost browser action under its URL policy. Browser work stopped without alternate-surface or indirect access. No revised UI screenshot, actual browser timing, navigation, desktop glanceability or narrow-layout acceptance is claimed. Previously saved screenshots describe a different recording order.

## Manual gates before filming

Use the [script](../../demonstration-script.md). Refresh the running app; Simulator → Reset case → confirm resets only the presentation case.

- [ ] Baseline H0: +0 delay, normal weather, original/revised delivery equal; draft edits do not mutate the active case. Show normal forecast before disturbance.
- [ ] Apply storm +3 days: clearly 18 → 21 January; receipt first, preparation then forecast-ready notice; opening resources remain fixed.
- [ ] Planner: no joint comparison before Generate; visible 2.5s preparation, old active schedule retained; navigate during preparation without duplicate readiness.
- [ ] Only Planner exposes review/approve/reject/activate. Dashboard and Monitoring link to it. Acknowledge does not approve or resolve conflicts.
- [ ] Activate V2: correct before/after trade-offs; conflicts resolve into history, resources do not jump.
- [ ] Weather H24 and generator H26: separate observed evidence; assessment precedes response-required; no instant replacement. Generate/authorize V3 explicitly.
- [ ] Connectivity: non-modal tray, five queued records for exact script, restore separate from outbox acknowledgement and forecast receipt.
- [ ] H48: five completed / one deferred, values agree with export and history persists after reload.
- [ ] Check desktop core visibility, narrow reflow, keyboard access, notification/dropdown positioning, controls and chart labels.
- [ ] User accepts the visual result and recording sequence.

Implementation and automated verification are complete. Demonstration-ready visual acceptance remains open.
