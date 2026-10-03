# Recording workflow verification — 3 October 2026

Scope: original app's browser-local presentation mode, not the FastAPI/PostgreSQL workflow. Preview `http://localhost:3001/`. The final user visual acceptance gate is still open.

## Automated evidence

- `npm run test:presentation`: **17 passed**. Includes deterministic comparisons, bounded independent inputs, nominal/adverse forcing, balances/resources/delivery, frozen history, completed work, severe/moderate/full-outage responses, no-go guard, lifecycle, restore/reset and independent connection clocks. The balance test runs multiple severity/delay/strategy combinations through H200.
- `npm run test:ui`: **41 passed** for the retained connected-UI model/transport modules.
- `npx tsc --noEmit`: passed.
- Scoped ESLint: no errors; two existing mixed-export Fast Refresh warnings (provider/hook and visual formatting utility).
- `npm run build`: client, SSR and server production build passed.
- Exporter stdout parses as JSON; **12 generated checkpoints**. `npm run recording:export` writes [data.json](data.json), using the same engine as the UI.

## Browser rehearsal

Performed through actual controls, not by injecting prebuilt state:

1. Operations H0 populated with weather, resources, original plan and actual resource-overlap warning.
2. Simulator baseline/current-state slab and weather/resource preview inspected. Original / energy-first / joint comparison selected.
3. Generated V2, reviewed, approved and explicitly activated. Inspected baseline forecast.
4. Previewed and applied weather plus three-day delay. Current fuel/battery/time retained. Forecast and planning exposure changed; field candidate H7–H10.
5. Generated V3; active V2 retained until review/approval/activation.
6. Advanced to H24, explicitly observed weather, advanced to H26, independently applied 10 kW derating. V4 appeared; playback paused, completed work retained.
7. Modeled uplink loss. Navigated to Planner while the connectivity tray remained open (non-modal); closed the tray and reviewed/approved/activated V4 without reconnecting.
8. Advanced to H48. Five completed / one deferred; approximately 240 kWh / 1,170 L, nominal pre-delivery fuel 765 L. Four actual actions queued during loss.
9. Reconnected: forecast age still 48h. Acknowledged four records: forecast age still 48h. Separate forecast receipt reset age to zero. Empty/repeated acknowledgement disabled.
10. Reload retained H48, V4 and completed history. Decision search/version filters operated.
11. Narrow Simulator at **390×844**: document width 375px (viewport 390px including scrollbar), no horizontal page overflow. Inputs/current-state cards reflow and scroll.
12. Separate full-outage branch: no-go displayed, Review allowed and **Approve disabled**. Reset returned recording state to H0.
13. Checked plot tabs/horizon, baseline preset (12% allowance is represented correctly by the slider), named generator/battery controls and dynamic shared-team assignment status.

Desktop reviewed at **1440×900**: Operations core fits one glance. Planner comparison, compact mission intervals, dispatch chart and human review fit together; detailed resource plots/constraints can scroll. Simulator keeps current state, main plot, draft inputs and exposure in one view; observed-event controls are a later, distinct area. Temporary viewport overrides were removed after verification.

## Issues corrected during verification

- Generator disturbance is independent, not automatically caused by weather.
- Reconnection/decision acknowledgement no longer manufactures a forecast receipt.
- Preview/approval no longer recomputes the observed prefix or debits the next interval's dispatch.
- A 48h outlook is actually 48h; current renewable share cannot exceed 100% of total supply.
- Mission completion uses executed intervals, with actual shared-team arbitration; an expired double-booked window is incomplete, not automatically delivered.
- Adverse reserve margin is shown on proposal review, rather than presenting nominal reserve as adverse assurance.
- A historical development hot-update `PresentationProvider is required` error was detected in console capture. Context identity was separated into `presentation-store.ts`. A fresh reload plus subsequent engine hot update and navigation produced **no new console errors**. Existing captured historical entries were not erased or misrepresented as a clean entire log.

## Preservation and limitations

Login/settings and protected backend main/planner file hashes match their pre-work hashes. No backend edits, migrations, DB operations or API mutation requests were performed. Existing unrelated dirty-tree work remains intact.

This is a controlled fictional case, bounded schedule search and modeled external link. No real station calibration, trained forecast validation, hardware control, authenticated approval, tested islanding, HQ synchronization or full backend stress test is claimed. Those are outside this recording delivery.

## Captures

- [Baseline forecast](baseline-forecast.jpg)
- [Simulator weather preview](simulator-preview.jpg)
- [Updated forecast](updated-forecast.jpg)
- [Weather proposal](weather-proposal.jpg)
- [Generator response](generator-response.jpg)
- [Connectivity loss](connectivity-loss.jpg)
- [Connectivity restoration](connectivity-restored.jpg)
- [H48 Operations outcome](operations-outcome.jpg)
- [Decision history](decision-history.jpg)
- [Narrow Simulator](simulator-narrow.jpg)
- [Full-outage no-go](no-go-outage.jpg)
- [Resource horizon](simulator-resources.jpg)
- [Prepared H0 Operations](operations-ready.jpg)

Some earlier captures show pre-polish wording; generated data and the shared engine are authoritative for values. The final prepared dashboard and resource-view captures reflect the delivered controls/layout.
