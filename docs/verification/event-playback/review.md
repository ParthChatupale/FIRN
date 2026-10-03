# Event playback verification — 3 October 2026

Scope: original browser-local recording UI. No backend/PostgreSQL, authentication, login/settings or separate frontend draft edits. Current [checkpoint plan](../../event-playback-plan.md) and [rehearsal sequence](../../demonstration-script.md) supersede prior playback instructions.

## Automated results

- `npm run test:presentation`: **50 passed** (17 core-model, 18 preparation/attention workflow, 15 minute playback/scene tests).
- `npm run test:ui`: **41 passed**, retained connected-UI regression tests.
- `npx tsc --noEmit`: passed.
- Scoped ESLint on changed TS/TSX: zero errors, two existing mixed-export Fast Refresh warnings.
- `npm run build`: production client/SSR/server build passed.
- `npm run recording:export`: schema 4 with fifteen checkpoints, playback/minute state and served mission-minute credits.
- Protected login/settings and representative backend source hashes match the start-of-task values. No database commands/migrations performed.

Tests cover one-minute energy/fuel recurrence, identical manual and tick trajectories, no fictional hourly observation rows, H24/H26/H48 stops, preparation and authorization pauses, invalid deltas, exact completion times, no false completion under shared-resource/unserved intervals, reload/restore deduplication, malformed fractional snapshots, stale-task token invalidation, full-case outbox restoration and approval/activation lead-time checks. Model tests remain distinct from browser-rendering tests.

## Physical and event results

The generated scripted branch retains the prior physical outcome: V1 → V2 → V3, H24 approximately 340 kWh / 1,526 L; H26 340 kWh / 1,498 L; H48 240 kWh / 1,170 L, five completed missions and one deferred. Completion records appear at H10, H14, H18 and H22, and sample preservation completes at H35 after the generator revision. They are not all stamped at the destination of a time jump.

During the exact link-loss segment, five proposal/decision/link records exist at V3 activation. Sample preservation’s start and completion add two, yielding **seven queued records at H48**. Synchronization and forecast receipt remain separate. The exporter advances logically; it does not measure browser playback timing.

## Minute model boundary

Weather forcing and forecast sampling remain hourly. Within each interval, the model integrates held dispatch in one-minute portions and credits supplied mission work. Event/activation changes begin a new dispatch segment without jumping inventory; completion releases finished mission demand. This is not new weather training, real sensor sampling or production equipment control.

The default 30-minute authorization/mobilization allowance is illustrative and configurable, not a universal operational standard. Paused review does not consume station time, but proposed new work still has a lead allowance and authorization revalidation.

## Browser acceptance still required

The earlier localhost browser action was explicitly denied by the app’s URL policy. No alternate access workaround or new browser capture was used. User screenshots verified portions of the prior rehearsal, not this new clock/layout. Do not mark minute playback’s visual acceptance complete based on these source/model tests.

- [ ] Reset once and verify baseline H0 stays paused, with V1, +0 delay and normal weather.
- [ ] Observe preparation/ready/authorization pauses and the corrected lifecycle labels.
- [ ] Activate V2, click clock and see minute time, inventory and mission progress evolve together.
- [ ] Navigate while playing; no second timer or duplicate completion notices.
- [ ] Open rehearsal controls; clock pauses. Save/restore a fractional-time scene and confirm the whole case resumes from it, still paused.
- [ ] Confirm H24 stop → explicit weather observation → manual resume → H26 asset stop → assessment → explicit V3 authorization.
- [ ] Inspect actual running/next/recent missions, completion timestamps, completed/upcoming Gantt states and legend.
- [ ] Continue to H48; check outcomes, seven-record outbox and separate receipt/acknowledgement.
- [ ] Check keyboard access, compact notification scrolling, dropdown positioning and narrow layouts.
- [ ] Final user visual approval before filming.
