# Recording delivery goals

Current scope: [rehearsal corrections](rehearsal-corrections-plan.md), original `src/` app. This replaces the prior recording order, not the backend roadmap. Backend/PostgreSQL, login/settings, connected routes and separate `frontend/` draft remain untouched.

## Story and authority

Use the [thirteen-scene narration/action script](demonstration-script.md): dashboard → active Planner introduction → Simulator baseline → normal forecast → draft/apply delayed resupply and storm → updated outlook → Generate joint response → review/approve/activate V2 → observe weather → independent generator assessment → Generate/authorize V3 → continue/reconnect → outcomes/history.

Operations is situational awareness and attention. Monitoring is execution evidence. Mission Planner is the sole proposal authorization workspace. Forecast edits never authorize a new plan; alert acknowledgement never resolves a condition or approves anything.

## Implementation checkpoints

- [x] Baseline controls match applied inputs: +0 additional delay, baseline weather; original/revised/draft arrival dates are distinct.
- [x] Named weather choices, physical before/after values, bounded advanced downside assumptions and current-state visualizations.
- [x] Shared preparation lifecycle: 2.5s minimum proposal, 1s forecast, 1.2s asset assessment; results/ready notices publish after completion.
- [x] No joint comparison before Generate; input changes/reset invalidate stale tasks; navigation does not recreate the task.
- [x] Event-driven priority/clock/action attention queue and header notifications; acknowledgement is independent of resolution.
- [x] Only remaining shared-resource conflicts and actual weather thresholds produce current condition notices.
- [x] Operations/Monitoring link to Planner rather than duplicate authorization.
- [x] Observed weather and generator events remain independent; severe loss requests a planning response, not an instant proposal.
- [x] Shared physical recurrence, completed-history preservation, versioned schedules and no-go approval guard.
- [x] Connectivity remains non-blocking with independent forecast receipt and outbox acknowledgement.
- [x] Revised script, model notes and fifteen-checkpoint logical export agree on V1 → V2 → V3 and five completed / one deferred.
- [ ] Revised browser rehearsal: preparation timing, navigation, notification ordering, layout and responsive controls.
- [x] Event-based minute playback, served-work lifecycle notifications, running/next/recent mission activity and full-case scene snapshots implemented and automatically tested.
- [x] Configurable authorization/mobilization allowance with activation revalidation; lifecycle labels, mission legend/status and compact attention lists corrected.
- [x] Final scoped addition: physically consistent 48h pre-H0 history, shared observed-data views, UTC timestamps and checkpoint boundary. Planning, playback, mission ledger and recording outcomes unchanged; history is inspection context, not forecast training data.
- [ ] User-led verification of clickable clock, auto stops, scene restore, live mission progress and revised visuals.
- [ ] Final user visual approval before filming.

Historical continuity implementation and checks: [review](verification/historical-continuity/review.md).

Automated results and the browser-access limitation are recorded in [verification](verification/rehearsal-corrections/review.md). Historical screenshots do not verify the revised workflow.

## Boundaries

All values derive from one fictional station case, not per-screen filler. Nominal/adverse bands are explicit assumptions, not calibrated forecast probabilities. Minimum intervals are presentation pacing, not measured backend solver latency. Real sensor/network adapters and authenticated hardware actuation remain intended integrations, not implemented claims.

## Manual completion

Reset the recording case, walk the script one scene at a time, and verify baseline/forecast first, delayed readiness, notice routing, sole human authority, independent generator assessment, continuity and final outcome. Desktop/narrow visual checks remain necessary; automated source/model tests are not a substitute.
