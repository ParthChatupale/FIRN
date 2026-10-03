# Historical continuity — final scoped addition

## Implemented

- 48 pre-case station intervals, 13 Jan 2026 06:00 UTC through the H0 boundary on
  15 Jan 06:00 UTC. Shared baseline environmental forcing; normalized negative-hour
  daylight. Routine daily storage-buffer policy, generator fuel equations, and
  integrated resource accounting close at 312 kWh / 1,650 L.
- Opening fuel 1,778.715 L; historical consumption 128.715 L. No delivery,
  demonstration mission execution or future storm knowledge in historical intervals.
- Operations → Observed, Simulator → Observed history (Power/Weather/Resources),
  and Monitoring show shared prior operation plus recorded execution/current minute.
  UTC labels, date tooltips, hourly table and Case H0 marker distinguish the time span.
- Monitoring uses no invented pre-H0 issued-plan reference. Current execution remains
  indexed from H0; historical reads do not change completion counts or workflow state.
- History derives deterministically for existing saves and scene restores, without
  resetting cases or changing storage keys. Sources and script document the boundary:
  this is simulated operating context, not real telemetry or forecast training data.

## Automated checks

- Presentation: **57 passed**, including 7 new history checks for temporal coverage,
  interval power/resource balance and bounds, endpoint continuity, negative-hour
  daylight, mutation isolation, scenario independence, minute/reload behavior and
  unchanged V2/V3 mission outcomes.
- Connected UI regressions: **41 passed**.
- TypeScript no-emit check passed.
- Scoped ESLint: zero errors; existing mixed-export Fast Refresh warning remains in
  presentation-visuals.tsx.
- Production client/SSR/server build passed; existing tsconfig-paths plugin notice.
- Logical recording export regenerated with historical basis. Existing fifteen
  checkpoints remain unchanged; H48 still has five completed / one deferred,
  239.508 kWh and 1,169.521 L.
- Login/settings/backend protected file hashes unchanged. No database writes,
  backend changes, planner replacement or clock/checkpoint redesign.

## Remaining visual acceptance

No automated browser visual pass is claimed: browser access was previously denied
by the URL policy and has not been retried or bypassed. User-led screenshots/rehearsal
are required for final recording approval.

Refresh the app. On Operations choose Observed; at fresh H0 it must show two days of
history ending at the current 312 kWh / 1,650 L. Inspect Simulator history Power,
Weather and Resources. Change/apply future assumptions and confirm those earlier
readings do not change. Return to Plan outlook and continue the agreed scene order.
Resume after activation and verify running/completed missions and H24/H26/H48 stops.
No further feature additions are planned; only demonstration-blocking corrections.
