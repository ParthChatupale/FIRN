# FIRN Development Roadmap

This is the project’s single progress tracker. The existing React workspace is the product prototype; the Python simulation engine is implemented as a separate foundation. FIRN’s target is an operator-reviewed mission and station-energy decision-support workflow.

## How to track progress

- Check a task only when its stated evidence or acceptance criteria are met.
- A phase is complete only when every required task and its exit gate are complete.
- Keep detailed domain definitions in `docs/firn-domain-spec.md`, the product proof standard in `docs/firn-demonstration-contract.md`, and the simulator audit in `docs/simulation-gap-report.md`; this file tracks order and progress.
- Do not describe synthetic station values as calibrated data or the current system as synchronized with a real station.

## Current project state

- [x] React/TanStack workspace with overview, mission, energy/assets, forecast, scenario, and decision-log views.
- [x] Standalone, standard-library Python simulation package in `backend/simulation/` with hourly state updates and a scenario CLI.
- [x] Six repeatable scenarios, including reduced battery capacity, with regression coverage.
- [x] Simulator independently audited against the frozen FIRN domain specification; remaining model gaps are documented.
- [x] FastAPI application scaffold and initial PostgreSQL persistence migration applied to local `firn_db`.
- [x] Local app configuration and PostgreSQL API round trip verified; Scenario Simulator frontend connected to run/retrieve persisted results.
- [x] Forecasting, optimization, monitoring, and the backend plan lifecycle are implemented.
- [x] Phase 7 product workflow connects the frontend to persisted runs, plans, plan history, and simulated monitoring evidence.

The station and operating values are currently synthetic. The Phase 2 `simulation_runs` and `simulation_telemetry` tables, Phase 5 plan workflow tables, and Phase 6 monitoring tables are applied in the user's WSL PostgreSQL `firn_db`. The Phase 7 frontend work is tracked in `docs/phase-7-demonstration.md`. This is not the final FIRN operational database schema.

## Phase 0 — Problem, research, and scope

**Goal:** Record what FIRN is intended to demonstrate and which claims the project can support.

- [x] State the central hypothesis: does joint mission and energy planning improve outcomes over separate scheduling approaches?
- [x] Record that the differentiator is the integration of mission requirements, energy/fuel limits, uncertainty, and operator review—not any individual method by itself.
- [x] Choose the station archetype to represent. Keep Polar Station Alpha explicitly synthetic unless a real station and evidence-backed configuration are selected.
- [x] Document authoritative references for Antarctic station energy, logistics, and operating constraints.
- [x] List in-scope capabilities and deferred work (for example, live telemetry, multi-station operations, physical control, detailed thermal networks, and advanced AI).

**Exit gate:** Scope, station archetype, research references, and claim boundaries are written down.

## Phase 1 — Domain model and evaluation contract

**Goal:** Define FIRN’s entities, constraints, and success measures before fixing database schemas or optimizer behavior.

- [x] Create `docs/firn-domain-spec.md` as the source of truth.
- [x] Define station state, assets, availability, energy loads, fuel/resupply, weather, missions, equipment, personnel, events, forecasts, simulation runs, and plans.
- [x] Define units, time conventions, state transitions, and the meaning of each mission/load priority.
- [x] Separate simulator behavior from later planning decisions: the simulator executes a supplied schedule; the optimizer will propose one.
- [x] Define hard safety/feasibility constraints separately from soft objectives such as scientific value, lateness, fuel use, renewable use, and plan stability.
- [x] Define primary metrics: science completion/value, fuel at resupply, critical-load and reserve violations, mission lateness, and plan changes.
- [x] Specify Schedule-first, Energy-first, and Joint FIRN comparison baselines, including how runs use matched seeds and initial conditions.

**Exit gate:** The domain contract and evaluation measures are specific enough to test without relying on the frontend as the definition.

## Phase 2 — Backend foundation and simulator integration

**Goal:** Establish the Python API and PostgreSQL foundation, then expose the existing simulator through one end-to-end workflow.

### Backend and database foundation

- [x] Add a maintainable Python project setup and local dependency management.
- [x] Configure FastAPI, SQLAlchemy, Alembic, and Pydantic around the frozen domain contract.
- [x] Create and verify a dedicated PostgreSQL application role; keep credentials out of Git and avoid using the `postgres` superuser from the app.
- [x] Use the existing `firn_db` and begin with one Phase 2 persistence schema.
- [x] Configure a local `DATABASE_URL` in ignored `.env`; the current credential is for local development only and should be rotated before any shared deployment.
- [x] Apply and verify revision `0001_simulation_runs` in `firn_db`.
- [x] Manually create and retrieve a 30-day `normal` run through the live API; verify all 720 hourly telemetry rows in PostgreSQL.
- [x] Add migrations, database health checks, `GET /api/health`, and `GET /api/station`.
- [x] Verify API behavior uses an isolated in-memory test database and verify the live PostgreSQL migration/schema.
- [x] Verify a live PostgreSQL API round trip manually and add an opt-in PostgreSQL plan-lifecycle integration test against isolated `firn_test_db` (`tests/test_postgres_integration.py`, `docs/postgresql-integration.md`). The test database is migrated independently; test rows roll back after each run.

### Simulator verification gate

Complete the audit below before treating persisted simulation results as trusted inputs to forecasting or optimization. API scaffolding can proceed while the audit is underway.

- [x] Create `docs/simulation-gap-report.md` and classify requirements as correct, simplified, missing, or not needed yet.
- [x] Check energy accounting with a clearly defined system boundary, including battery conversion losses.
- [x] Check SOC, fuel, generator output, and tank-capacity limits at every timestep.
- [x] Check storm effects, generator failure/recovery, delayed resupply, and critical-load violations.
- [x] Verify mission weather, equipment, personnel, duration, and energy behavior.
- [x] Show that an 80 kW × 4 h mission requires 320 kWh **and** changes a resource trajectory compared with the same run without it.
- [x] Verify the same seed reproduces the full result and a different seed changes stochastic weather.
- [x] Record gaps such as low-battery/degradation events, startup delay, deadlines, precedence, and interruptibility; implement only those required by the domain contract now.
- [x] Apply targeted fixes and rerun the acceptance suite (20 non-CLI simulator tests and 5 API tests pass here; the CLI output test is blocked by this environment's temporary-directory permissions).

### Persisted API and first product slice

- [x] Preserve the tested simulation engine as a separate domain service; do not build a second engine inside the API.
- [x] Add `POST /api/simulation-runs`, `GET /api/simulation-runs`, `GET /api/simulation-runs/{id}`, and run telemetry/event retrieval endpoints.
- [x] Store the exact configuration snapshot, scenario, seed, simulator version, summary, hourly telemetry, events, and mission results for each run.
- [x] Add API and database integration tests for creating and retrieving runs against an isolated test database.
- [x] Connect the Scenario Simulator screen to this API as the first frontend vertical slice; submit, retrieve the saved run, and display summary/telemetry.
- [x] Manually verify the browser flow against PostgreSQL, including the scenario, duration, and random-seed controls.

**Exit gate:** A scenario can be submitted from the application, executed by the existing engine, saved in PostgreSQL, and retrieved with its telemetry and events. The simulator gap report has no unresolved issue that invalidates the next phase. Automated PostgreSQL regression coverage remains recommended, but live local verification and isolated API tests provide current evidence.

## Phase 3 — Forecasting, uncertainty, and scenarios

**Goal:** Produce useful forecasts and explicit alternative future conditions.

- [x] Select and document a provisional weather hindcast source, licence/attribution, time resolution, and missing-data policy; defer geographic selection until a real reference site is approved (`docs/forecasting-data-and-baselines.md`).
- [x] Establish deterministic persistence and daily seasonal-naive forecast baselines with rolling-origin evaluation for hourly numeric series (`backend/simulation/forecasting.py`).
- [x] Evaluate persistence and daily seasonal-naive baselines across 20 seeded synthetic holdouts; report the seed spread without treating it as calibrated uncertainty (`backend/simulation/forecast_evaluation.py`, `docs/forecasting-data-and-baselines.md`).
- [ ] Select an approved reference geography and evaluate against an external hindcast and observed station demand if available; assess interval calibration before presenting probability ranges.
- [x] Run a first 168-hour held-out comparison of persistence and daily seasonal-naive methods on a fixed synthetic trajectory; record metrics and explicitly limit their interpretation (`docs/forecasting-data-and-baselines.md`).
- [x] Generate deterministic, interpretable favorable, nominal, low-renewable, and storm trajectories with documented assumptions (`backend/simulation/forecast_scenarios.py`).
- [x] Propagate each trajectory through the existing simulator under matched settings and compare energy, fuel, and mission feasibility (`docs/forecasting-data-and-baselines.md`).
- [x] Label all four trajectories as synthetic assumptions; do not present them as calibrated probabilities (`docs/forecasting-data-and-baselines.md`).

**Exit gate:** Forecast baselines, scenario generation, uncertainty representation, and evaluation results are reproducible and documented.

## Phase 4 — Joint mission–energy optimization

**Goal:** Generate feasible candidate schedules that account for science, energy, fuel, uncertainty, and shared resources.

- [x] Build and test a first MILP using Pyomo and HiGHS; keep solver selection provisional until alternatives are benchmarked (`docs/optimization-prototype.md`).
- [x] Model mission selection/timing, generator output, battery charge/discharge/state, fuel trajectory, equipment/personnel exclusivity, and weather limits in the prototype.
- [x] Keep station-load service, generator/battery limits, fuel inventory, mission weather eligibility, and shared resources as hard constraints; expose the priority/fuel objective.
- [x] Return a structured proposed schedule, dispatch, objective breakdown, feasibility status, and independent simulator replay (`backend/optimization/planner.py`).
- [x] Test a feasible case, weather-ineligible mission, resource-infeasible case, and unsupported event handling (`tests/test_optimization.py`).
- [x] Add planning-rule inputs for mission finish deadlines and precedence, plus targeted power-bottleneck diagnostics for infeasible runs (`backend/optimization/planner.py`). Full IIS/minimal-conflict diagnosis remains deferred.
- [x] Benchmark HiGHS against OR-Tools CP-SAT on the exact same deterministic integer scheduling subproblem; retain Pyomo/HiGHS for the continuous-energy MILP and keep the production solver choice provisional (`backend/optimization/benchmark.py`, `docs/optimization-prototype.md`).
- [x] Compare Schedule-first, Energy-first, and Joint FIRN on matched synthetic runs, documenting the heuristic definitions and interpretation limits (`backend/optimization/baselines.py`, `docs/optimization-prototype.md`).
- [x] Extend the physical operating model with generator ramp/start/minimum-up/down constraints, terminal battery policy, resupply delays, and deterministic uncertainty-aware optimization using documented synthetic assumptions (`backend/optimization/planner.py`, `backend/simulation/models.py`, `docs/optimization-prototype.md`).

**Exit gate:** The optimizer returns valid, inspectable plans and demonstrates measured behavior against baselines; no claim of superiority is made without evidence.

## Phase 5 — Plan management, explanations, and operator approval

**Goal:** Turn optimizer output into a controlled decision-support workflow.

- [x] Define immutable plan versions and lifecycle states: proposed, reviewed, approved, active, superseded, and rejected (`backend/app/models.py`, `backend/app/plans.py`).
- [x] Store mission timing, dispatch, battery/fuel trajectories, assumptions, and solver/model version with each plan (`plan_versions`, Alembic revision `0002_plan_management`).
- [x] Produce explanations from structured results: changed action, reason, modeled binding-limit evidence, and before/after impact (`docs/plan-management.md`).
- [x] Support plan comparison and operator edits/approval; require explicit approval before activation (`/api/plan-groups/.../compare`, `/api/plans/.../edits`, `/api/plans/.../actions`).
- [x] Record approval, rejection, and modification history as append-only plan events (`plan_events`).

The API workflow and migration are covered by automated tests. Revision `0002_plan_management` is applied to the local WSL `firn_db`; no plan data was added to that database as part of schema verification.

**Exit gate:** An operator can compare versions, see why a plan changed, and explicitly approve or reject it.

## Phase 6 — Monitoring and adaptive replanning

**Goal:** Detect meaningful divergence from an active plan and propose a controlled revision.

- [x] Add a persisted simulation playback clock and compare actual state with active-plan dispatch and weather expectations (`backend/app/monitoring.py`).
- [x] Monitor weather, renewable output, demand, SOC, fuel runway, generator status, critical-load service, and mission progress (`backend/app/monitoring.py`).
- [x] Define two-hour signal persistence/clear hysteresis, an initial freeze, a post-proposal cooldown, and a modeled-benefit threshold with explicit high-severity exceptions (`docs/monitoring-and-replanning.md`).
- [x] Create a checkpoint-based child proposal after a significant event while retaining the current active plan until explicit approval and activation (`backend/app/monitoring.py`, `backend/app/plans.py`).
- [x] Test storm, generator failure, sustained low renewable output, delayed resupply, and mission-response monitoring end to end (`tests/test_monitoring.py`).
- [x] Demonstration Checkpoint 4 extension: continue the same session after explicit replacement activation with carried state, recorded remaining work, absolute time and the declared generator-first/approved-missions policy. This does not implement MILP dispatch execution; see `docs/verification/checkpoint-4/review.md`.

**Exit gate:** A significant simulated change creates an explainable proposal while preserving operator control and plan history.

## Phase 7 — Frontend product workflow

**Goal:** Evolve the prototype into the user interface for the working backend and decision loop.

- [x] Retain useful visual components and responsive patterns from the current workspace.
- [x] Replace hardcoded scenario results with API data and explicit loading/error/empty states.
- [x] Build station overview, mission workspace, proposed/active plan, plan comparison, monitoring, and decision history around actual domain objects.
- [x] Provide timeline, energy, battery, fuel, mission, and risk views aligned to the same time axis.
- [x] Support scenario what-if, plan review, operator edits, and explicit approval.
- [x] Verify the core workflow at laptop and presentation sizes.

**Exit gate:** The operator can move through the complete workflow using persisted backend state rather than frontend-only scenario objects.

**Phase 7 refinement:** A dedicated Monitoring route now keeps the operator's current simulated state, plan status, next action, deviations, and persisted alerts available without navigating through the planning workspace.

## Phase 8 — Evaluation and stress testing

**Goal:** Measure whether FIRN improves outcomes and where it does not.

- [ ] Run Schedule-first, Energy-first, and Joint FIRN on matched scenarios, initial states, and seeds.
- [ ] Evaluate normal, storm, generator failure, and resupply-delay conditions across multiple seeds.
- [ ] Report science completion/value, fuel at resupply, mission lateness, critical/reserve violations, renewable use, generator runtime, and plan churn.
- [ ] Vary flexible science-load share and resupply delay to identify where joint planning helps.
- [ ] Compare perfect-information, point-forecast, and uncertainty-aware cases where data supports the comparison.
- [ ] Include solver runtime, infeasibility rates, assumptions, and limitations in the results.

**Exit gate:** Results are repeatable, baselines are fair, and conclusions distinguish measured benefits from assumptions.

## Phase 9 — Final demonstration and handoff

**Goal:** Present one coherent, evidence-backed FIRN operating story.

- [ ] Prepare a normal operating state with an active, operator-approved plan.
- [ ] Introduce a storm or asset failure, show monitoring detect the change, generate a new proposal, explain the difference, and capture operator approval.
- [ ] Show the resulting simulated execution and state history.
- [ ] Prepare a clean run procedure, environment/configuration instructions, test command, and known-limitations section.
- [ ] Package screenshots, diagrams, and evaluation evidence for the target presentation or competition.
- [ ] Ensure the story clearly labels synthetic data and does not imply connection to real station equipment or telemetry.

**Exit gate:** A fresh checkout can run the product workflow and reproduce the evidence used in the demonstration.

## Explicitly deferred

- [ ] Live Antarctic station telemetry or physical equipment control.
- [ ] Multi-station planning, detailed AC power flow, full thermal-network physics, and electrochemical battery aging.
- [ ] Deep learning, reinforcement learning, LLM decision-making, multi-agent systems, and autonomous approval.
- [ ] Kubernetes, microservices, Redis, Kafka, or multiple databases unless measured needs justify them.
