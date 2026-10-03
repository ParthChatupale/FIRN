# FIRN presentation workspace

Current implementation follows [rehearsal corrections](rehearsal-corrections-plan.md), the [thirteen-scene script](demonstration-script.md) and [model assumptions/results](recording-model.md). Earlier H36 closing and V2/V3/V4 choreography are superseded.

## Boundary and entry

Recording mode lives in the original `src/` app. Shared workflow uses `firn:presentation:v3` browser storage; legacy v2 state is validated when restoring and is not deleted. Backend workflow storage is separate.

- `/?workspace=presentation`: recording mode, also the default for its seven routes.
- `/?workspace=backend`: retained API-connected workspace, requiring its usual services.
- `npm run dev`: use Vite’s printed port.

No backend files, PostgreSQL schema/migrations, login/settings or separate `frontend/` draft changes are part of these corrections.

## Continuous case

Fictional coastal summer station, 15 January 2026 06:00 UTC. V1 original → apply storm/delay outlook → request/authorize joint V2 → observed weather H24 → independent generator derating H26 → assess/request/authorize adaptive V3 → H48 outcomes.

Future drafts do not mutate the applied case. Applied forecast revisions preserve observations and current inventory, with the previous published outlook retained while preparing. Generation captures the current basis; alternatives become visible after preparation. Activation can change current dispatch, not opening resources or completed history.

| Screen | Purpose |
| --- | --- |
| Operations | Current station data, resource outlook, commitments and compact actionable attention; no authorization |
| Simulator | Baseline/draft/applied inputs, physical comparisons, heterogeneous views, distinct observations and scoped reset |
| Look ahead | Normal forecast first, then published revised outlook and active-plan exposure; forecast-context attention only |
| Mission Planner | Active schedule first; Generate, comparisons, dispatch, changes, review/approve/reject/activate |
| Monitoring | Clock, observed/reference comparisons, mission progress and independent event assessment; links to Planner |
| Energy & Assets | Capacity, generation/storage, modeled loads and resources |
| Decision Log | Inputs, events, proposal and human-decision lineage |

## Preparation and attention

Shared workflow state owns tasks across navigation. Minimum visible intervals: proposal 2.5s, forecast 1s, event assessment 1.2s. These are configured presentation intervals, not backend benchmarks. Stale completions cannot publish; interrupted/failed work supports retry.

Input/event receipt and result readiness are separate. Alerts retain station time and sequencing metadata. Acknowledging an item means seen; condition resolution, proposal approval and external synchronization remain distinct operations. Upcoming conflicts expire from the current queue once passed or resolved; mild weather cannot claim a restriction without crossing configured limits.

Connectivity is a non-modal tray. Link state, forecast age/receipt and outbox acknowledgement use separate clocks. Physical sensor adapters remain unconnected. Sources preserves that boundary without covering operator views with explanatory banners.

## Verification and next rehearsal

See [current verification](verification/rehearsal-corrections/review.md). Prior [recording screenshots](verification/recording-case/review.md) are historical.

The revised browser rehearsal was blocked by the app’s browser-access policy, so visual layout and actual UI timing have not been re-verified. Reset the recording case and follow the script. Check desktop glanceability, narrow reflow, notification access and preparation across navigation before approving filming. Passing model tests does not establish visual acceptance or real-station readiness.
