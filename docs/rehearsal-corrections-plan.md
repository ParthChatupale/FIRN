# Rehearsal corrections — goals and execution plan

Status: implementation and automated verification completed on 3 October 2026; revised manual browser rehearsal and user visual acceptance pending. This supersedes the earlier recording order and presentation acceptance claims where they conflict with the corrections below. It does not replace the backend roadmap or authorize backend/database work. The previous exported recording and screenshots remain historical evidence, not verification of this revised sequence.

## Outcome

An operator sees a coherent baseline, introduces explicitly identified future disturbances, understands their forecast consequences, requests a joint response, reviews it and authorizes activation. Subsequent observations and equipment events update execution evidence and attention items. No recommendation appears before it has been requested and prepared; no forecast revision silently changes the active plan.

Use the original `src/` app and its shared case/provider. Preserve login/settings, backend-connected workspace, backend/PostgreSQL, separate `frontend/` draft and unrelated local edits. These corrections are implemented in the original recording UI and shared workflow; protected systems remain unchanged.

## Screen responsibilities

| Screen             | Responsibility                                                                                                                           | Decision controls                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Operations         | Glanceable station dashboard: current power/weather/inventories, active plan, resource outlook, mission commitments and attention queue  | Acknowledge attention items; open the relevant detail or proposal. No review/approve/reject/activate lifecycle controls |
| Scenario Simulator | Inspect baseline data; draft, preview and apply future logistics/weather inputs; inject separate observed events for rehearsal           | Apply inputs/events, advance simulation, scoped reset. No implicit plan activation                                      |
| Look ahead         | Normal forecast first; then revised weather/renewable/demand outlook, baseline comparison, downside assumptions and active-plan exposure | Open planning response. No authorization                                                                                |
| Mission Planner    | Active schedule first; generate a versioned response; inspect comparisons, changes, dispatch and reserves                                | Sole location for generate, review, approve, reject and activate                                                        |
| Monitoring         | Execution clock, observed-versus-issued-plan evidence, mission progress, event impact and outstanding attention                          | Rehearsal time/event controls; open Mission Planner when a response is required. No authorization                       |
| Decision Log       | Retained inputs, observed events, preparation results and human decisions                                                                | Inspect/filter history, not approve plans                                                                               |
| Connectivity       | Non-blocking modeled external-link state, forecast receipt age and decision outbox                                                       | Existing explicit connection/receipt/acknowledgement operations; not alert acknowledgement                              |

“Review replacement” is navigation to Mission Planner for a revision of remaining work after a disturbance. Prefer an explicit label such as “Open revision in Mission Planner” if a proposal exists, or “Assess planning response” if none exists. It is not a second approval workspace and never means automatic equipment control.

## Input and model contract

- [x] On fresh/reset baseline and route re-entry, initialize controls from applied inputs: additional resupply delay **+0 days**, baseline weather, baseline downside assumptions. No silently preloaded +3-day storm draft.
- [x] Display original delivery **18 January 2026, 06:00 UTC**, additional delay, and revised delivery. A +3-day delay means **21 January**, not three days until arrival. Show draft/applied status clearly.
- [x] An active plan retains its issue/basis version. Applying revised inputs updates the outlook and evaluates that active schedule's exposure; it does not relabel the old plan as already adapted. Generation captures the currently applied input version.
- [x] Present the two recording disturbances as identifiable choices: **Resupply delay** and **Storm front**. Make generator derating/outage a separate observed asset event. Keep relevant supported variations available; do not add nonfunctional disturbance options.
- [x] Replace headline “weather deterioration 85%” with a named condition and physical before/after values: wind km/h, temperature °C, visibility km, cloud cover where supported, event date/time. Internal intensity may remain in an advanced disclosure, not as a meteorological probability.
- [x] Rename/explain the downside assumption. A 30% renewable reduction retains 70% of nominal availability before other adverse changes; it is not 30% remaining generation or a learned confidence level. Document the linked weather/demand adjustments instead of calling this solely a renewable allowance.
- [x] Expose relevant baseline station values and projected changes without crowding the dashboard: baseline weather, demand, mission loads, capacities, battery/reserve and fuel. Do not invent independent measurements to fill panels.
- [x] Current inventory and completed history survive forecast edits and activation. Dispatch rates may change immediately on activation; fuel/battery inventory changes through elapsed intervals. Forecasted weather/arrival need not change merely because a schedule changed.
- [x] Show active-versus-proposed projected consumption, battery margin, fuel at arrival, mission completion/deferral and conflicts on matched input basis and horizon. A trade-off can use more fuel to preserve battery or deliver work. Do not manufacture universal improvement.

## Preparation and notification timing

The current recording engine is local and synchronous; no measured real-station forecasting or solver latency exists. The implemented timings are explicit presentation pacing, not claims of cloud/backend optimization performance. Actual forecast/planning readiness must still gate result publication.

- [x] Forecast lifecycle: draft edit -> preview only; apply -> input receipt/assumption record; preparing -> result available for that input revision -> forecast-ready notification. Stale results must not be published as current.
- [x] Planning lifecycle: active schedule/needs-response -> Generate -> preparing -> versioned proposal ready -> review -> approve -> activate. No joint candidate metrics or revised schedule revealed before generation completes. Alternative comparisons become available with the generated result.
- [x] Use a shared configurable **2–3 second minimum visible preparation** for proposal generation. Publish only after both preparation work and that presentation interval finish. Forecast refresh can use a shorter configured transition (initial target around one second); immediate input/event receipt is separate from completion.
- [x] Show an indeterminate preparing indicator and truthful status, not invented percentage progress or an uncalled backend solver. Disable duplicate requests. Navigation must not lose the task or cause duplicate notifications.
- [x] Cancel/invalidate pending work on reset or changed input basis; ignore late completion of superseded work. No approval while results are preparing. Failed/no-go completion receives an appropriate result notice, not a success notice.
- [x] For generator loss, publish the observed event first, then assess the active plan. If a response is needed, raise “Planning response required”; do not announce a ready replacement before preparation. Generation/authorization remain in Mission Planner. Moderate capacity loss may need no new proposal.
- [x] Keep clocks distinct: simulated station time for event/effective timestamps; monotonic UI elapsed time for preparation pacing. A three-second transition at H0 does not advance the station to H1. Record sequencing IDs and receipt/completion metadata where needed; do not create fictional elapsed station minutes.

## Attention system

Operations gets a compact priority-sorted “Attention required” queue; the shell gets an unread/unacknowledged count and an accessible expandable event list. No blocking arrival modal, oversized explanation card or random toast to manufacture movement. Forecast and Monitoring use relevant contextual subsets of the same records, not separately invented alerts.

Each item has a stable ID, condition/event type, station timestamp, priority, consequence, associated case/input/plan version, suggested action, active/resolved state and acknowledgement state. New-event notices are distinct from persistent conditions and from the full Decision Log.

| Trigger                                                | Expected notice / condition                            | Routing and lifecycle                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Baseline case loaded with future team overlaps         | Upcoming shared-resource conflicts                     | Inspect active schedule; caution based on upcoming affected work; do not announce a newly occurring physical fault |
| Logistics revision applied                             | Revised delivery received                              | Informational receipt; add fuel-risk attention only if the evaluated exposure warrants it                          |
| Revised forecast completes                             | Forecast updated; affected field/resource exposure     | Open Look ahead; distinguish predicted restriction from observed restriction                                       |
| Proposal preparation completes                         | Proposal ready / cannot produce an authorizable plan   | Open Mission Planner; readiness only after completion                                                              |
| Joint revision activated                               | New plan active; applicable conflicts resolved         | Resolve current condition, retain historical record; current resources unchanged                                   |
| Weather actually applied at its observation checkpoint | Weather restriction observed, if actual limits crossed | Inspect Monitoring; do not replay this notice when merely editing future weather                                   |
| Generator event observed                               | Available generator capacity reduced                   | Inspect Monitoring; severity depends on consequence, not simply event name                                         |
| Active plan fails assessment after an event            | Planning response required                             | Open Mission Planner; no ready-proposal claim until prepared                                                       |
| External link changes / forecast becomes stale         | Relevant connectivity/freshness notice                 | Open Connectivity; alert acknowledgement is not external decision synchronization                                  |

- [x] Prioritize by consequence and time available for response. Use informational/advisory, caution and warning/critical consistently with text/icons, not color alone. Full outage does not automatically mean a blackout if backup still supplies demand; critical requires corresponding modeled consequence.
- [x] Acknowledgement means “seen”, not “fixed” and not plan approval. Deduplicate ongoing conditions; route changes/reloads must not reannounce the same event.
- [x] Count only actionable remaining/future shared-resource conflicts as current conditions. Retain passed conflicts as history rather than reporting them forever.
- [x] Derive field restrictions from actual weather limits. Fix the current unconditional H10–H14 message for any positive weather severity; mild conditions must not claim a nonexistent restriction.
- [x] Remove unrelated shared-team warnings from the main weather-forecast alert list. A relevant link to planning impact can remain.
- [x] Derive healthy/no-issue wording from the assessed conditions, not merely absence of selected event flags. Never imply measured hardware health or certified safety.

Design references: [HSE alarm management](https://www.hse.gov.uk/humanfactors/topics/alarm-management.htm) emphasizes actionable, relevant alarms and defined responses; [NASA display guidance](https://www.nasa.gov/reference/appendix-f-vol-2/) describes persistent key context and alert priority/time/acknowledgement information. These inform the design; this prototype is not claimed compliant or certified. A single authorization workspace is our chosen interaction design, not a universal rule imposed by those sources.

## Revised recording order

1. Problem hook and Operations baseline.
2. Brief Mission Planner introduction: active V1 schedule and real upcoming conflicts; no joint results yet.
3. Simulator baseline: controls match applied inputs; show the station data and visualization options.
4. **Normal forecast**: explain weather-to-renewable/demand/resource relationships before introducing disturbance.
5. Simulator: preview/apply additional resupply delay and a named storm front; distinguish original/revised arrival and current/future weather.
6. Forecast preparation completes; notice leads to updated outlook, affected windows and active-plan resource exposure.
7. Generate joint response in Mission Planner; hold on preparation; reveal comparison and changes only when ready.
8. Review, approve and activate; Operations confirms the new plan, unchanged current inventories and revised projections.
9. Advance execution to the weather checkpoint; observe conditions and compare against issued outlook. This is a separate forecast-verification scene, not a duplicate future edit.
10. Independent generator loss at H26; observed impact, active-plan assessment and response-required notice.
11. Generate/review/authorize remaining-work revision in Mission Planner, optionally with the modeled external-link interruption.
12. Continue to H48, connectivity recovery and separate decision acknowledgement/forecast receipt.
13. Outcomes and decision history closing frame.

Plan versions and final numerical outcomes have been regenerated from this order: V1 original → V2 first joint response → V3 generator revision; H48 has five completed / one deferred mission. Do not reuse old V2/V3/V4 choreography or old outcome numbers as guaranteed values. The normal forecast scene and independent generator scene remain mandatory.

## Execution checkpoints and manual gates

| Checkpoint                                         | Implementation scope                                                                                                                            | Automated verification                                                                                                                    | Manual browser acceptance before next checkpoint                                                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Coherent baseline and inputs                   | Applied-aligned defaults, clear arrival dates, named weather/physical comparisons, downside disclosure and plan basis                           | Initial/reset/route re-entry, draft versus applied, independent delay/weather inputs and untouched observed prefix                        | H0 has +0 delay and baseline weather; adjusting draft does not alter active state; +3 days clearly moves 18 -> 21 January                   |
| 2 — Generated results and sole authorization       | Shared preparation state, delayed reveal, ready/error notification, before/after evidence; lifecycle actions only in Planner                    | Duplicate request, stale basis, navigation, reset/cancellation, no-go, generation-before-publication and approval guards                  | No joint result before Generate; preparation visible; active plan retained; meaningful trade-offs appear; approval only in Planner          |
| 3 — Event-driven attention                         | Priority/time/acknowledgement records, dashboard queue/header access, contextual lists, corrected conflict/weather predicates                   | Baseline/forecast/observed triggers, passed conflicts, mild weather, deduplication, reload, acknowledgement versus resolution             | Notices arrive in the correct order; identify consequence and action; acknowledge does not fix or approve; no repeated alerts on navigation |
| 4 — Execution and generator response               | Monitoring read-only decision links, distinct observed weather and generator assessment, conditional response generation, connectivity retained | Completed work/history retained, issued reference preserved, moderate/severe/full-loss branches, blocked approval and disconnected outbox | Observe weather only at its checkpoint; generator event produces capacity evidence before response readiness; open Planner to decide        |
| 5 — Script/data reconciliation and final rehearsal | Update full narration/actions, regenerate export/model outcomes, revise goals and verification evidence; compact responsive polish              | Model/UI tests, TypeScript, scoped lint and build; all revised checkpoint values and inventory recurrence                                 | Walk the complete revised sequence one scene at a time, desktop/narrow checks, capture screenshots; user explicitly accepts before filming  |

Keep these checkpoints few and scoped. Inspect existing implementation before replacing it; reuse the shared model/provider rather than constructing another frontend. No backend debugging, migrations, new forecast-training claim, unrelated authentication redesign or decorative dummy metrics in this correction work.

## Completion gate

- [x] All five checkpoints implemented and automatically verified.
- [x] Revised script/export/assumptions agree with the implemented source contract and V1/V2/V3 plan versions. Browser appearance/timing still requires manual acceptance.
- [ ] Full user-led rehearsal accepted, including baseline forecast, preparation intervals, notice timing, human authority and generator scene.
- [ ] Final visual approval recorded. Implementation is complete; do not call the revised presentation ready to film until this gate is accepted.

## Implementation verification

All five implementation checkpoints are covered by model/source checks: 35 presentation/workflow tests and 41 retained connected-UI tests passed; TypeScript and production build passed. Scoped lint has zero errors and two existing Fast Refresh warnings. The regenerated export has fifteen logical checkpoints. See [verification and manual gates](verification/rehearsal-corrections/review.md).

Browser access was explicitly blocked by the app’s URL policy; no workaround, screenshots or revised browser rehearsal were performed. Historical screenshots cannot satisfy the manual gates in the table above. A static source-wiring test verifies authorization placement, not browser rendering or navigation behavior.
