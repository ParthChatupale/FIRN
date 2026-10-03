# Event-driven rehearsal playback

Scope: original browser-local recording UI only. Preserve backend/PostgreSQL, login/settings and the separate frontend draft. Introductory scenes remain at H0; no automatic resume after a pause.

Status: implemented and automatically verified; updated browser rehearsal/final user visual acceptance remain pending. Verification is [recorded here](verification/event-playback/review.md).

| Story checkpoint | Pause trigger | Resume condition |
| --- | --- | --- |
| Baseline H0 | Load/reset | First plan activated before execution playback |
| Revised forecast | Applied inputs / forecast completion | Deliberate operator continuation; no automatic playback |
| Proposal review | Generation starts / proposal ready | Review, approve and activate or reject |
| First authorization | V2 activated | Click clock to begin execution |
| Weather checkpoint H24 | Execution reaches configured storm onset | Observe weather, then click clock to continue |
| Weather observed | Explicit observation | Deliberate resume |
| Generator checkpoint H26 | Execution reaches asset checkpoint | Apply disturbance and wait for assessment |
| Assessment / replacement | Assessment ready / response required / proposal ready | Generate, review and authorize remaining-work response |
| Replacement activation | V3 activated | Click clock to continue |
| Outcome H48 | End of execution horizon | Remains paused; inspect/sync/outcome scene |

Checkpoint dates are simulated case dates, not shooting deadlines. Ordinary mission completions notify and record exact completion time without pausing by default. Manual jumps must use the same interval integration and stop at unobserved weather/asset checkpoints.

## Implementation contract

- Minute clock integrates hourly forcing/dispatch in one-minute intervals; no independent wall-clock animation or background catch-up.
- Resources and served mission-minute credits advance together; a blocked/unserved interval cannot credit completion.
- Mission events emit once and feed notifications, Monitoring history and Decision Log. Reload/retakes retain the event ledger.
- New work respects a configurable authorization/mobilization lead allowance (default 30 simulated minutes); preserve ongoing/completed work. Revalidate proposal basis and lead time on activation.
- Clickable accessible clock, discreet state indication, explicit rate controls in rehearsal panel. Restore/reload always pauses.
- Named full-case snapshots in an off-record rehearsal panel; reject malformed snapshots, preserve backend storage, invalidate pending task tokens on restore.
- Fix mission state/legend, lifecycle badge, stale receipt text and oversized contextual attention lists.

## Acceptance

- [x] Minute resource/mission conservation, manual-versus-playback equivalence and boundary pause tests.
- [x] Correct mission event timestamps, deduplication, interruption/no-go and restore validation.
- [x] Shared clock/activity source integration, review margin and immutable history.
- [x] Updated script/export/outcomes, TypeScript, tests, scoped lint and production build.
- [ ] User-led browser rehearsal and final visual acceptance.

## Rehearsal controls

Click the header clock to toggle execution. Shift-click the clock, press Alt+R, or open Sources → Playback & scene checkpoints to access the off-record panel. Opening it pauses playback. Rate controls are explicitly 1/6/30 station minutes per second, not actual station real-time operation. Restore/reload pauses, and there is no hidden wall-time catch-up. Close the panel before filming.

Stable storyboard pauses automatically save named full-case snapshots. Save additional named scenes manually for retakes, especially a running-mission shot. Restoring asks for confirmation and preserves PostgreSQL/backend storage; removing a saved snapshot does not delete the current case. Reset leaves saved scenes available.
