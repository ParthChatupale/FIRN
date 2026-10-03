# Plan management and operator decision workflow

**Status:** Phase 5 backend workflow slice. The API and persistence run against the synthetic station model; they do not operate real station equipment.  
**Updated:** 2026-10-02

## What this phase provides

FIRN can create an optimizer proposal, persist the complete proposal and its provenance, create child versions for operator schedule edits, explain the modeled decisions, compare versions, and record review/approval/rejection/activation actions. Proposal creation always starts in `proposed`; it never activates a plan implicitly.

The workflow uses the existing Pyomo/HiGHS planner and Phase 2 SQLAlchemy/PostgreSQL setup. `plan_versions` stores each immutable version, while `plan_events` records append-only lifecycle and edit history. Version identity, parent link, source run, scenario/settings, solver/model versions, the complete schedule/dispatch/objective/replay snapshot, and structured explanations are captured. Editing creates a new version; it does not rewrite the prior plan.

## Lifecycle

```text
proposed ──review──> reviewed ──approve──> approved ──activate──> active
    │                    │                    │
    ├──approve───────────┘                    └──reject──> rejected
    └──reject──────────────> rejected

active ──new approved plan explicitly activated for same station──> superseded
```

The API also allows direct approval from `proposed`. `active`, `superseded`, and `rejected` plans cannot be edited in place or reactivated. A new approval is required before a proposal or edited child version can be activated. The database's partial unique index and transactional replacement logic permit at most one `active` version per station name.

The `actor` field is an operator label supplied by the caller; authentication and authorization are not implemented in this phase. It must not be represented as verified identity or a security boundary.

## API

All endpoints are under the existing FastAPI application:

| Method and path | Behavior |
|---|---|
| `POST /api/plan-proposals` | Run the optimizer and persist a new `proposed` version. Optional `source_simulation_run_id` links a prior run; scenario, duration, seed, and start time are inherited, and conflicting explicit settings return 422. |
| `GET /api/plans?status=...&station_name=...` | List versions, optionally filtered by lifecycle state and station. |
| `GET /api/plans/{plan_id}` | Retrieve the complete version and its event history. |
| `GET /api/plan-groups/{group_id}/versions` | List ordered versions in a plan lineage. |
| `POST /api/plans/{plan_id}/edits?actor=...` | Submit `{"mission_start_hours": {"mission-id": hour}}`; validate the fully fixed proposed schedule with the optimizer and create a new `proposed` child version. |
| `POST /api/plans/{plan_id}/actions` | Submit an explicit `review`, `approve`, `reject`, or `activate` action with `actor` and optional `note`. Invalid state transitions return 409. |
| `GET /api/plan-groups/{group_id}/compare?baseline_version=1&candidate_version=2` | Compare mission selection/timing and objective/replay metric deltas for two versions in one lineage. |

Every stored proposal includes the optimizer result (schedule, hourly dispatch, battery/fuel trajectory, objective, assumptions, and simulator replay), the source inputs, solver name/version, planner model version, mission-level explanations, observed binding-limit evidence, and replay outcome metrics.

“Binding constraint evidence” is inferred by checking returned values against modeled limits. It is useful context, not a solver IIS, proof of causality, calibrated risk explanation, or operational recommendation. Version comparison reports raw differences; it does not assert that one plan is preferable.

## Migration and local verification

The schema change is Alembic revision `0002_plan_management`, following the existing `0001_simulation_runs` revision. It adds plan versions, append-only plan events, status/value checks, foreign keys, version uniqueness, and the single-active-plan-per-station partial unique index. It does not replace or rewrite the Phase 2 simulation tables.

After reviewing the migration, apply it from WSL in the project environment:

```bash
alembic -c backend/alembic.ini upgrade head
```

Then run the backend tests:

```bash
pytest -q
```

Fast API lifecycle tests use an isolated in-memory SQLite schema. Application persistence uses PostgreSQL; separate integration tests and browser rehearsal use the existing `firn_test_db` with rollback isolation. The original frontend is connected to the lifecycle and monitoring APIs, including explicit checkpoint continuation. See [Checkpoint 4 verification](verification/checkpoint-4/review.md) for coverage, review steps and the execution-policy boundary. No migration or production-data reset is performed as part of the frontend review.
