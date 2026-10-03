# Presentation workspace verification

Verified 03 October 2026. This is a frontend presentation acceptance record, not backend stress-test certification or user visual acceptance.

## Automated checks

- `npm run test:presentation`: 9 passed. Includes supply/demand balance, resource bounds and recurrence across five policy variants through H215, unchanged current observations on outlook edits, separate authorization/activation, H26 pause, history continuity, shared-team scheduling, field-window timing, malformed storage recovery and idempotent mock acknowledgements.
- `npm run test:ui`: 41 existing frontend checks passed.
- `npx --no-install tsc --noEmit`: passed.
- Scoped ESLint on the new presentation TypeScript and root integration: no errors; two non-blocking Fast Refresh export warnings.
- `npm run build`: production client/server build passed. Vite reports the pre-existing tsconfig-path plugin advisory.

## Browser observations

- Baseline H0: populated weather/time, 312 kWh battery, 12,480 L fuel and active V1. No empty placeholder chart.
- Scenario applied at H0 changes future outlook/resupply, not current observations. V2 requires review, approval and explicit activation.
- H24 weather arrival and H26 capacity reduction: DG-01 changes from 100 to 65 kW; time pauses with V3 proposed and V2 still active.
- V3 proposes calibration deferral and sample preservation H29 → H33. Completed work remains completed.
- Modeled uplink loss at H26: review/approval/activation still work locally. H36 reaches five completed missions and one deferred; current fuel 11,987 L and battery 178 kWh, above the 100 kWh reserve.
- Reload at H36 retains V3, clock, lost uplink and four queued records. Reconnection does not acknowledge records automatically; explicit acknowledgement clears the queue and disables repeat acknowledgement.
- Browser console recorded no warning/error entries in the checked walkthrough.
- At 1440×900, all core Operations panels (including three conditions and operator action at H36) fit above y=870; expanded hourly detail may scroll. No horizontal overflow.
- At 1920×1080, baseline mission-window panel ends at y=924. No horizontal overflow.
- At 390×844, layout reflows without horizontal overflow; mobile navigation opens and reaches Scenario Simulator. Vertical scrolling is expected.
- Secondary controls checked: BESS detail selection, Data Sources disclosure, Escape drawer dismissal, Decision Log search/no-match state and plan-version filter.
- Reset returns to the H0 baseline. No migrations, optimizer invocation, PostgreSQL mutations or backend service changes were made during this frontend work.

## Captures

- [Baseline Operations](operations-baseline.jpg)
- [Baseline strategy comparison](planner-baseline.jpg)
- [H26 pending operator decision](monitoring-h26.jpg)
- [H36 Operations](operations-h36.jpg)
- [Mock acknowledgements](connectivity-h36.jpg)

## Boundaries retained

The model is deterministic and illustrative. The charts are not a calibrated prediction system; the strategy comparison does not benchmark the backend optimizer. Approvals are browser-local presentation actions, not authenticated industrial authorization. The external link, receiver and acknowledgements are modeled, not a tested real outage/synchronization protocol. Sensor adapters are described as the intended integration pathway and are not physically connected. These details remain available in Station data and Connectivity rather than repeated explanation cards.

Login/settings sources and the original API-connected route components are retained. Open `/?workspace=backend` to use them; backend runtime/integration/stress testing is separate and was not re-certified by this presentation pass. The remaining acceptance gate is the user's visual review and recorded rehearsal.
