# FIRN demonstration delivery checkpoints

Status: Checkpoints 1–4 implemented and verified within the coverage recorded below; awaiting user review. Checkpoints 5–6 remain pending. No checkpoint has been accepted.

## Current decision and scope

Improve the original frontend in `src/`, connected to the existing FastAPI and PostgreSQL services. Preserve the separate `frontend/` draft without developing, deleting, or switching to it. This decision supersedes the separate-application implementation boundary in `ui-product-architecture.md`; useful visual principles in that document remain references, not evidence of delivered work.

The demonstration contract remains the source of truth for the product claims. The main roadmap remains the tracker for engineering/evaluation phases. This document defines small delivery gates and manual reviews; it does not mark historical roadmap tasks complete.

The recording tells one operator story: establish the operating picture, examine uncertainty, choose a joint plan, experience a meaningful change, review the response, and finish with measured evidence and decision history. External-uplink resilience is a short supporting beat, not a second communications project.

## Working and acceptance rules

- Implement and test one checkpoint, open its original-frontend UI, and stop for the user's review before moving to the next checkpoint. The user authorized joint delivery of Checkpoints 2 and 3; their acceptance gates remain separate.
- Record implementation status separately from automated verification, manual verification, and user acceptance. A screenshot alone does not prove functionality.
- Preserve existing work and backend records. Do not rebuild the database or rerun migrations as a visual-redesign step. Any necessary schema change gets its own explanation and validation.
- Test writes use isolated fixtures or the agreed test database; do not reset or overwrite `firn_db` to rehearse.
- Prepare a repeatable normal/disruption case with matching seeds, initial state, and time convention. First screen means a verified prepared case, not fabricated numbers.
- Every meaningful metric, chart, plan status, action and queue count has a source. Keep projected values separate from observed values and full-run totals separate from current-hour state.
- Use explicit loading, unavailable, stale, constrained and error states. Never fill a failed API response with plausible-looking measurements.
- Remove repetitive engineering/prototype copy from operator panels, not provenance itself. Keep a concise environment indicator, accessible About/methodology and case details, and a video disclosure. No implication of real station telemetry, calibrated probabilities, hardware control or production authentication.
- All interactive controls must work or be explicitly unavailable. No decorative Save, Login, Settings, notification, filter, export or connection buttons.
- Retain routes and integrations while refining information hierarchy. New navigation follows operator jobs, not a list of differentiators.

## Proof moments and recording requirements

| Moment | Operator hook | Required visible evidence |
|---|---|---|
| Operating picture | What requires my attention before authorizing work? | Critical-service state, protected battery margin, fuel/resupply horizon, active plan, next mission and next action. |
| Look ahead | What if conditions deteriorate? | Nominal/adverse assumptions and aligned resource consequences; no invented probability band. |
| Joint planning | Can this mission fit weather, resources and energy? | Mission lanes aligned with energy dispatch, resource/window restrictions and selection/timing decisions. |
| Safety and trade-offs | Why defer this work? | Short decision-specific explanation, applicable constraint, consequence and a deliberate no-go state when no feasible plan exists. |
| Authority | What changes if I accept the proposal? | Active/proposed distinction, aligned comparison, review, approval and explicit activation. |
| Adaptation | Does the approved plan still hold? | Clock advancement, observed-versus-plan deviation, trigger, affected work and linked replacement. |
| Local resilience | What happens when the external uplink disappears? | Separate uplink/local-node states, forecast age, actual local actions, a documented simulated synchronization queue. |
| Accountability | Was the decision useful, and can we reconstruct it? | Verified matched-case outcomes and linked observation/proposal/approval history. |

## Checkpoint 1 — Coherent workspace and supporting product surfaces

Goal: reliable context and complete interaction surfaces before visual refinement.

Deliverables:

- One selected station/run, selected proposal, separately identified active plan, monitoring session and explicit time cursor. Validate linkage after refresh, route changes and run changes.
- Distinguish operating time, recording wall-clock time and projected horizon. Display timezone and units consistently; do not default one panel to the final run hour while the header reports the initial hour.
- Temperature, wind and timestamp come from the telemetry record matching the shared cursor. Before monitoring, use an explicitly identified initial/prepared observation rather than reading only `latest_observation` from a nonexistent session. Telemetry already includes temperature and wind; extend frontend types/loading rather than inventing new readings.
- Remove the full-screen introduction/feature explanations and repeated raw IDs from primary operator surfaces. Put evidence and assumptions in contextual details.
- Functional navigation, profile/operator-entry surface, Settings and About. Preserve original routes or provide verified redirects when labels change. Forecast/assets may be contextual tabs/details without losing their accessible routes.
- Settings include genuinely implemented preferences: units/time display, reduced motion and default playback step; saving and reloading must work. An endpoint/connection diagnostic must actually test health if offered.
- The operator-entry/login-looking surface is presentation identity selection, not a security boundary. Do not collect fake passwords or claim authenticated roles/access control. Any real authentication/authorization is separately scoped and tested; an actor label in a decision log is not authenticated identity.

Manual browser check:

1. Enter the workspace and open every navigation destination, profile, Settings and About.
2. Select the prepared run; compare the clock, wind, temperature and selected plan across routes.
3. Reload and change runs; verify no prior plan/session evidence is displayed under the new run.
4. Change a supported setting and reload; verify persistence and unit correctness.
5. Exercise empty, missing-record and API-unavailable states; zero and negative measurements remain valid values.

Acceptance:

- [x] Implementation complete.
- [x] Automated context/loading/formatting checks pass.
- [x] Manual browser check recorded with screenshots and observations.
- [ ] User reviewed and accepted.

Evidence: [Checkpoint 1 verification and review instructions](verification/checkpoint-1/review.md). Supporting identity is a local operator profile, not production authentication. This gate does not complete the one-glance dashboard, forecasting API exposure, checkpoint continuation or modeled connectivity gates.

## Checkpoint 2 — One-glance Operations dashboard

Goal: answer safety, active plan, change and next decision together at a desktop recording size.

Deliverables:

- Rename the primary view to Operations (or Operations Center) while retaining the existing home route.
- Compact station/clock/plan header, critical-service status and decision metrics: battery above reserve, fuel runway under stated assumptions, resupply countdown and mission delivery. Do not label a consumption-based runway as a calibrated survival prediction.
- One near-term supply/demand view and aligned battery/fuel plots with reserve and resupply annotations. Do not imply renewable generation alone represents total supply; include generator/battery contribution correctly where available.
- Compact mission lanes and a next-decision queue linked to real proposals/events.
- Replace the stretched empty lifecycle panel with a compact prerequisite/action state. Remove generic capability cards and move full-run summary to case details.
- Supporting details for asset output, availability and constraints, weather regime/visibility, next mission and selected event. These useful details need not all be narrated.
- Current versus projected markings, meaningful tooltips, readable units, keyboard focus, and a text/table way to inspect chart values. Unavailable fields remain honest.

Manual browser check:

1. At 1440 x 900 and 1920 x 1080, inspect core status, active plan, change and next action without whole-page scrolling.
2. Inspect laptop/narrow/zoomed layouts; vertical reflow is allowed, clipped content and horizontal page overflow are not.
3. Compare displayed metrics with matching backend records and configured reserve/resupply policies.
4. Open every detail, tooltip and action; verify non-narrated supporting features are functional.
5. Check normal, alert, no-proposal and unavailable states, not only the prepared happy path.

Acceptance:

- [x] Implementation complete.
- [x] Metric calculation and formatting tests pass.
- [x] Manual browser/viewport review recorded.
- [ ] User reviewed and accepted.

Implementation complete: Operations now has current-hour metrics, aligned resource charts, mission lanes, a linked next-decision queue and contextual details. See the [Checkpoints 2–3 review record](verification/checkpoint-2-3/review.md). The alert-generating Operations browser case remains a rehearsal gap; backend alert logic and next-action routing have automated coverage. This is not acceptance of Checkpoint 4 monitoring behavior.

## Checkpoint 3 — Look-ahead, joint planning and controlled no-go

Goal: expose the existing decision engines and make their consequences understandable.

Deliverables:

- Expose existing Python forecast/scenario capabilities through explicit API contracts and UI views. Show at least nominal/adverse futures and their assumptions; distinguish forecasts, assumed trajectories and observed playback.
- If robust planning is demonstrated, connect actual scenario-envelope inputs to the optimizer and return its planning mode/assumptions. A badge or wider chart band alone is not uncertainty-aware planning.
- Show mission schedule and dispatch on a common horizon, with selectable mission dependencies and weather/resource restrictions.
- Return targeted infeasibility diagnostics as structured results and present an operational shortfall/no-go with limitations. Do not invent a minimal-conflict diagnosis or guarantee physical safety.
- Clear version comparison, concise explanations and explicit review/approve/reject/activate actions. Show the active plan separately from whichever proposal is selected.
- Handle longer solver/replan calls without a misleading universal 15-second failure. Test pending, timeout and recovery/retry behavior; guard against unnoticed duplicate proposals.
- Preserve requested case assumptions and model/configuration identity rather than silently substituting a newer default configuration for an old saved run.

Manual browser check:

1. Inspect two future conditions and explain the actual change in resource consequences.
2. Generate a feasible proposal; select a mission and trace its relevant constraints.
3. Make a feasible timing edit and inspect the persisted difference.
4. Attempt a verified infeasible case/edit; verify the reason is useful and the prior plan remains unchanged.
5. Review, approve and activate deliberately; reload to verify persisted state/history.

Acceptance:

- [x] Implementation and API integration complete.
- [x] Forecast, planning, lifecycle and constrained-case tests pass.
- [x] Manual browser workflow recorded.
- [ ] User reviewed and accepted.

Evidence: [Checkpoints 2–3 review record](verification/checkpoint-2-3/review.md). Full saved-case alternatives and prefix-only point baselines are distinct. Robust proposals use an actual conservative weather envelope, not calibrated probabilities. Solver retries and timing edits use request identities to avoid duplicate versions. A deliberately stalled 120-second browser request was not exercised; transport timeout/recovery has automated coverage.

## Checkpoint 4 — Monitoring, revision comparison and execution boundary

Goal: one connected adaptive story with correct time/state alignment.

Deliverables:

- Real playback controls driven by persisted observations; advancing the clock updates the matching weather, resources, assets, missions and event queue across views. No random counters or independent chart loops.
- Focused observed-versus-plan plots, trigger thresholds, event markers, affected missions and concise next action. Historical high-severity events must not automatically masquerade as currently active alerts.
- Checkpoint proposals show remaining work and resource posture at a common absolute time origin. Do not compare opening-horizon totals to shortened remaining-horizon totals as like-for-like improvements.
- Review/approval/activation preserve lineage, retain the current active plan until explicit replacement and refresh all dependent views.
- Decision Record links observation, trigger, revision, explanation and operator actions; supporting filters/details function.

Promoted backend requirement, not a dummy UI feature:

Delivered: initial monitoring uses the original saved replay. Explicit checkpoint activation now continues the same session using `generator_first_approved_missions_v1`: approved remaining mission timings, carried battery/fuel/generator state, remaining disruptions/resupply and retained observed history. It does **not** execute MILP dispatch. A replacement's new reference starts at the next absolute hour and is never overlaid on earlier observations. Energy balance, battery bounds/reserve and fuel bounds are checked before activation.

Recording boundary: demonstrate operator-approved mission continuation under the declared simulator dispatch policy, not physical control, live assimilation, optimized-dispatch execution or certified safety. See the [Checkpoint 4 verification record](verification/checkpoint-4/review.md).

Resolved audit findings: checkpoint inputs retain saved station configuration and planning policy; exact remaining hours avoid padded days. Completed work is excluded only from recorded completion events, not an elapsed planned window. Unstarted/deferred work remains eligible; in-progress work retains only its recorded remaining duration without recharging mission fuel. Rejected proposals no longer leave a blocking pending pointer. Sustained faults remain active conditions, distinct from historical events.

Manual browser check:

1. Advance the prepared disruption case to its verified event; compare header, charts and observations at the same hour.
2. Verify a meaningful trigger produces a linked proposal rather than automatic activation.
3. Compare remaining-horizon work, review and activate; inspect lineage/history after refresh.
4. If continuation is implemented, advance beyond replacement and verify no state reset, duplicated resupply, repeated completed mission or time jump. Otherwise show the honest boundary and do not record a continuation claim.

Acceptance:

- [x] Implemented scope and execution policy recorded.
- [x] Monitoring, time-alignment and revision tests pass; continuation tests pass if in scope.
- [x] Manual browser workflow recorded.
- [ ] User reviewed and accepted the recording boundary.

## Checkpoint 5 — External-uplink resilience prototype

Goal: demonstrate the local-node distinction without pretending to have remote infrastructure.

Implementation classification:

- Real: local FastAPI/solver/PostgreSQL run, retrieve, review and monitoring actions.
- Modeled: external uplink, external forecast provider, HQ receiver and remote synchronization acknowledgements. There is currently no real external integration to disconnect or synchronize.
- Missing/stale data never becomes live hardware telemetry. The prototype uses the station model and persisted observations.

Deliverables:

- A Connectivity detail surface and compact status indicator, separating external uplink, local API/database, station-model observations and external forecast freshness.
- State sequence: connected -> uplink lost/local mode -> reconnecting -> synchronized. The simulation control explicitly models the external link; it must not disable browser networking or localhost calls.
- Last-received external-model forecast timestamp and age, with declared freshness thresholds. Use one declared clock for age; do not mix simulated days with elapsed wall-clock minutes.
- On modeled uplink loss, freeze external refresh and age the saved forecast; local actions continue only while API/database are actually available. Keep the existing active plan until an operator changes it.
- If degraded assumptions change planning, apply and return a real conservative scenario/reserve policy through the planner. Otherwise display freshness degradation only; do not claim the optimizer became conservative because its badge changed.
- A retained outbox of actual locally created record references, timestamps and states. Queue counts derive from queued items, not a timer. Provide reload persistence, ordered processing, acknowledgement state, idempotent replay and failure/retry handling against a mock receiver.
- Reconnection processes the mock queue and records mock acknowledgements. About/connection details state that no external HQ or station system received data.
- Local API loss is separate: retained last-known state is timestamped/stale, actions are blocked, health is unavailable and recovery requires an actual successful local response. No green engine-online status or fictitious successful saves.
- Check external runtime assets (including the current Google Fonts stylesheet), use bundled/fallback resources, and test reload with the external network unavailable. Do not claim offline availability of an application that still requires external assets to load.

Manual browser check:

1. Model an external outage and verify a real local read, proposal/review action and clock advancement still succeed where the selected plan permits them.
2. Confirm forecast timestamp remains fixed and its age/state changes correctly; current observations remain distinct from future projections.
3. Generate eligible local records and inspect their actual queue references/counts; reload and verify retention.
4. Restore the modeled link; inspect mock acknowledgements, duplicate protection and failed-sync retry.
5. Independently exercise actual local-API unavailability using an isolated test service; verify stale readings, disabled writes and honest recovery.

Acceptance:

- [ ] Prototype and real/modelled boundary implemented and documented.
- [ ] Connectivity state, freshness, queue/idempotency and local-failure tests pass.
- [ ] Manual browser outage/reconnection review recorded.
- [ ] User reviewed and accepted.

## Checkpoint 6 — Evaluation, full-product rehearsal and recording readiness

Goal: an evidence-backed story and a polished interface beyond the narrated path.

Deliverables:

- Preliminary feasibility selection happens before major UI work: choose baseline/disruption cases that produce verified outcomes. Extend Phase 8 evaluation during Checkpoints 3-5; do not leave discovery of failed scenarios until the final rehearsal.
- Run matched Schedule-first/Energy-first/Joint cases across the agreed scenarios/seeds. Report outcomes, runtimes, infeasibility, reserve/critical violations, assumptions and cases where joint planning does not help.
- Connect verified results to a concise comparison view. No hardcoded improvement percentages or inappropriate perfect-information versus forecast comparisons.
- End-to-end API/PostgreSQL and browser regression checks, including lifecycle/reload, old/mismatched IDs, timeout/recovery, no-go, monitoring and connectivity states. Migration checks are separate from applying migrations; no application-data reset.
- Whole-product review: every visible route, tab, control, notification, setting and entry/profile surface; no dead ends, placeholder buttons or accidental raw exceptions. Optional exports must reproduce available records or stay unavailable.
- Visual review at desktop, laptop and zoom/narrow widths: text/contrast/focus, chart labels/units, readable tooltips, aligned time, loading transitions, motion preference, persistent selection and no overflowing panels.
- Rehearsal shot list maps each problem hook to an operator action, expected result and supporting test/record. Include a concise prototype/data/connection disclosure, accessible provenance and a fallback recording case.
- Verify reproducible startup, prepared-case restore/reset-selection (not record deletion), local assets and clean screenshots before final narration.

Manual browser check:

1. Run the entire story from operator entry through persisted final decisions and verified comparison.
2. Explore non-narrated pages and all controls; check that their values share the selected case/time and their claims match functionality.
3. Repeat after refresh and a fresh application launch; repeat a constrained case and local/external connectivity failures.
4. Review the actual intended recording viewport and timing with the user; then finalize the narration.

Acceptance:

- [ ] Agreed Phase 8 evidence and claim limits recorded.
- [ ] Build, scoped lint, TypeScript, backend and PostgreSQL/browser regression checks pass or have explicitly accepted limitations.
- [ ] Complete manual rehearsal and non-narrated-surface audit recorded.
- [ ] User accepted recording readiness; only then mark applicable Phase 9 tasks complete.

## Deferred work: promote selectively, never claim via a dummy badge

Promote for this delivery: API exposure of existing forecasting/robust planning, meaningful no-go diagnostics, correct revision comparison, measured baseline evidence and the explicit checkpoint-continuation decision. These improve the central proof.

Add as a bounded prototype: external-uplink state/freshness/outbox/mock resynchronization. It models an integration contract, not an already deployed communications service.

Keep outside this delivery unless separately scoped: live sensor/industrial-control integration, multi-station coordination, detailed AC/thermal/aging physics, calibrated external-data forecasting, DL/RL/LLM/quantum claims, autonomous approval and infrastructure such as Kafka/Kubernetes. A configuration page may show an unconnected adapter as unconnected; it must not turn unimplemented capabilities into apparently working features. No fictitious safety certification, authenticated access control or remote synchronization.

## Review record template

For each checkpoint record:

- Date and checkpoint:
- Implemented scope and deliberately unavailable scope:
- Automated commands/results:
- Browser URL, viewport, selected case/plan and time cursor:
- Screenshots and manual steps/results:
- Discovered issues and retest results:
- User acceptance or requested revisions:

Current record: Checkpoint 1 implementation and verification are recorded in [its review record](verification/checkpoint-1/review.md). The user authorized Checkpoints 2 and 3 together; their implementation and review coverage are recorded in [the combined review record](verification/checkpoint-2-3/review.md). Checkpoint 4 is recorded in [its review record](verification/checkpoint-4/review.md). User acceptance remains pending. Checkpoints 5–6 have not started as delivery gates. Earlier Phase 7 results are historical audit evidence, not acceptance of these new requirements.
