# FIRN presentation workspace

The implemented recording workflow is governed by [delivery goals](recording-delivery-goals.md), the [fourteen-scene narration/action script](demonstration-script.md) and the [shared model assumptions/results](recording-model.md). Earlier fixed H0/H24/H26/H36 sequencing is superseded.

## Boundary and entry points

The recording mode lives in the original `src/` app. It uses `firn:presentation:v2` browser storage, not PostgreSQL or the API. Existing connected routes, backend files, login/settings and the separate `frontend/` draft are preserved. This does not replace the engineering roadmap or count as backend validation.

- `/?workspace=presentation` — recording mode (also the default for its seven routes).
- `/?workspace=backend` — retained API-connected workspace; still requires its usual services.
- Start with `npm run dev` and use Vite's printed port. This verification used `http://localhost:3001/`.

This is modeled forecasting, bounded schedule search and browser-local authorization, not measured MILP performance, calibrated prediction, authenticated safety control, real sensor telemetry or remote synchronization. Sources exposes that boundary without covering the operator view in explanatory banners.

## Continuous case and layout

Fictional coastal summer station, 15 January 2026 06:00 UTC. Original V1 → baseline joint V2 → revised weather/logistics V3 → adaptive V4. Future inputs change projections only. Observed weather H24 and independent generator derating H26 change current interval flows while preserving opening resources and completed observations. Continue to H48 for outcomes.

| Screen          | Evidence / functional controls                                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operations      | Current weather/clock, reserve/fuel/delivery, supply-demand graph, resource small multiples, mission windows, assets, risk/decision rail; observed/outlook toggle                                                         |
| Simulator       | Current-state slab, power/weather/resources/missions views, bounded resupply and weather inputs, input preview/applied/history, onset/horizon/adverse controls, before/after exposure, distinct observed events and reset |
| Planner         | Same-input original/energy-first/joint comparison, interval Gantt, dispatch and resource trajectories; propose/review/approve/reject/activate; no-go disables approval                                                    |
| Look ahead      | Nominal/adverse environmental assumptions, baseline/revised availability, weather restrictions and active-schedule resource exposure                                                                                      |
| Monitoring      | Explicit interval advance, observed weather and independent derating, frozen pre-event reference, actual mission outcomes, event history and pending approval                                                             |
| Energy & Assets | Nameplate vs available capacity, current generation/storage, modeled load breakdown and configured shared resources                                                                                                       |
| Decision Log    | Actual input/event/proposal/review/approval/activation records; search, version filter and detail                                                                                                                         |

Desktop: dominant data area plus bounded operational rail. Compact strategy comparison and Gantt keep mission timing, dispatch and human review visible together at 1440×900. Operations retains a one-glance core. Narrow views reflow and scroll; do not squeeze all operational evidence into a phone-sized viewport. Graphs use separate units for energy/fuel/weather, event markers and hourly tables rather than decorative animations.

Connectivity is a **non-modal tray** with no background scrim or focus trap. Local availability, external link, forecast age/receipt, contact and decision acknowledgement are separate. Loss queues actual actions; reconnection alone refreshes neither forecast nor acknowledgements. Physical sensor adapters remain planned/unconnected.

## Verification / rehearsal

The current [verification record](verification/recording-case/review.md) supersedes the [historical v1 record](verification/presentation-workspace/review.md). Model tests include parameterized balance/delivery cases, severe/moderate/full-outage branches, history continuity, completed work, no-go approval guards and independent connectivity clocks. Existing connected-UI regression tests are retained.

Follow the master script. To restart, Simulator → Reset case → confirm, then Operations. Reset touches only this recording case. For recording, avoid editing source during rehearsal: development hot reload may close a tray, although the case remains persisted.

Final visual acceptance remains a user checkpoint. Passing tests and an agent rehearsal are not acceptance of the design or real-station readiness.
