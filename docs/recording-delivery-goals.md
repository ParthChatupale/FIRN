# Recording delivery goals

This document records the current user-approved implementation scope. It supersedes the fixed-event presentation's old rehearsal sequence, not the backend engineering roadmap. Use the original `src/` app; preserve login/settings, API-connected routes, backend code and PostgreSQL. No migrations or database writes in this work.

## Story

1. Problem hook.
2. Operations: populated current station state.
3. Simulator: baseline station case and its operating data.
4. Planner: original / energy-first / joint comparison on identical inputs.
5. Review, approve and activate the baseline joint proposal.
6. Introduce baseline forecast and the nominal/adverse range.
7. Simulator: preview/apply resupply delay and revised future weather outlook.
8. Updated forecast, dashboard planning impact and affected mission/resource windows.
9. Review and activate the proposed joint revision.
10. Simulator/Monitoring: advance to and apply observed weather, without double-counting the forecast input.
11. Independent generator disturbance and observed-versus-reference impact.
12. Review the adaptive replacement; optionally model external-link loss while deciding.
13. Continue execution, restore modeled link and acknowledge actual queued decisions.
14. Final station outcomes and decision history.

Two primary scenarios: resupply delay and weather deterioration. Generator degradation is a separate observed asset event, not automatically caused by weather. The recording is sequential; navigation remains available and does not reset state. Presentation controls do not operate real hardware.

## Acceptance checklist

- [x] Reconcile master narration/action script with the sequence above and give the generator event its own scene.
- [x] One versioned case/configuration drives all routes and checkpoints; no per-screen invented values.
- [x] Deterministic interval model with power balance, battery efficiency/reserve, fuel consumption, equipment capacity and independent event timing.
- [x] Candidate schedules are derived from mission windows, resources and operating conditions; comparison conflicts/limits calculated, not hardcoded.
- [x] Nominal/adverse assumptions produce the forecast range; no calibrated-probability claim.
- [x] Simulator workspace: current-state slab, heterogeneous data visualizations, editable bounded inputs, before/after preview and distinct future/observed controls.
- [x] Dependent values change together; unchanged current resources/history remain unchanged after forecast edits and activation.
- [x] Planner separates comparisons, proposed and active schedules; no implicit activation; constrained outcomes are visible.
- [x] Dashboard, Forecast, Assets, Monitoring and Decision Log use the same clock, records and plan versions.
- [x] Connectivity is non-blocking, with independently tracked forecast receipt, connection transitions and decision acknowledgement; real local/backend health is never fabricated.
- [x] Timestamp/units/operator-readable asset names; clear stale-data, pending/no-go, reset/reload and unsupported-input handling.
- [x] Recording dataset/export script and assumptions/results document created; baseline/disruption branches validated logically.
- [x] Automated model/regression checks, TypeScript, scoped lint and production build pass.
- [x] Browser rehearsal of the complete story; desktop glanceability and narrow reflow verified with saved screenshots.
- [ ] Final user visual acceptance (cannot be marked by implementation alone).

Implementation verified on 3 October 2026: 17 model tests and 41 UI regression tests passed, TypeScript and production build passed, scoped lint reported no errors (two Fast Refresh warnings). The complete browser rehearsal, independent full-outage no-go branch, reload persistence and narrow-screen reflow are recorded in [verification](verification/recording-case/review.md). Narration is in [the script](demonstration-script.md); assumptions and limitations are in [the model document](recording-model.md). Final visual approval remains with the user.

## Simulator layout

Bounded three-area workstation: case/current-state slab; dominant power/weather/mission/resource visualization with selectable views; event input/preview/impact controls. Independent resupply, future-weather, observed-weather and generator controls. Functional supporting options: nominal/adverse preview, plot horizon, data view, event effective time/severity, interval advance, hourly table and scoped reset. No decorative disabled features or repeated explanatory banners.

## Data rules

Author a fictional station configuration and environmental/mission inputs, not desired outcome numbers. Model observations, future assumption versions, schedule versions, events and human decisions separately. Forecast revisions preserve current measurements and the observed prefix; activation preserves resource inventory and executed work. Scenario ranges are illustrative assumptions, not learned confidence intervals. A severe condition may require deferral/no-go, not a guaranteed success.

## Connectivity rules

The external link is modeled. Keep local operation visible during the segment. Loss prevents external forecast refresh and queues actual local decisions. Reconnection alone does not acknowledge records or refresh forecasts. Decision synchronization must not overwrite forecast-receipt timestamps. Empty/repeated synchronization is idempotent. Use readable dates and a compact disclosure; intended sensor adapters remain unconnected.
