# Phase 7 — Demonstration Story and Frontend Evidence

## Product message

FIRN turns changing station conditions into an explainable, constraint-checked mission-and-energy proposal while keeping the operator in control.

The interface must make the evidence visible. It must not imply live station telemetry, calibrated forecast probabilities, autonomous control, guaranteed safety, or an automatic replan when the backend only provides a simulated proposal.

## Demo sequence

1. **Establish the operating case.** On Station Overview, show the selected synthetic station, the most recent persisted simulation, current plan status, and key metrics from the run. If no run exists, show a clear start-scenario action rather than invented KPIs.
2. **Introduce a disruption.** Run a reproducible storm or generator-failure case with a visible seed and horizon. Show that the API stored the run and render hourly telemetry on one shared simulation-time axis.
3. **Generate a joint proposal.** Create a plan linked to that exact run. Show selected/deferred missions, dispatch, modeled fuel and battery trajectories, solver/model identity, and explicit limitations from the saved plan.
4. **Review before action.** Record review, allow a feasible mission-time edit where applicable, show version changes, and require explicit approval and activation. Never present a proposal as an active plan.
5. **Play the station forward.** Start monitoring only for a matching active plan and run. Advance the simulation clock in operator-selected increments; show actual-vs-plan deviations, event severity, and any checkpoint proposal. Preserve the active plan until a human approves and activates a child version.
6. **Close on evidence.** Decision Log lists persisted plan and monitoring events in timestamp/order context. Keep run IDs, seed, scenario, simulated time, and synthetic-data disclosure accessible for repeatability.

## What each screen proves

- **Overview:** current persisted run and plan lifecycle, with no placeholder measurements.
- **Scenario Simulator:** scenario inputs, repeatable run identity, outcome metrics, and the resource trajectory.
- **Forecast & Risk:** run telemetry and any explicitly stored forecast values; no fabricated confidence percentages.
- **Mission Planner:** proposal schedule, dispatch/reserves, structured explanation, immutable versions, operator review/approval/activation.
- **Monitoring:** a dedicated operator route with simulation-clock playback, observed-vs-plan comparison, visible data source, current weather/generator/mission state, persisted alerts, checkpoint replan, and operator control.
- **Decision Log:** actual run, plan, and monitoring records—not illustrative narrative entries.
- **Energy & Assets:** configured synthetic capacities/constraints and measured values from the selected run, labelled by source and time.

## Visual evidence to prioritize

- A single aligned time axis for renewable output, station demand, battery state, and fuel; use separate panels/scales so units remain honest.
- A mission schedule against that same simulation horizon, with selected/deferred state and planned start windows.
- A compact proposed-versus-active lifecycle view and measured before/after deltas when versions exist.
- Monitoring actual-vs-plan deltas and alert markers at the simulation hour that produced them.

Do not add decorative charts, probability gauges, live-looking animation, or invented station status. Every value in a chart should be traceable to a run, plan, or monitoring observation.

## Scope boundary

This phase is a local product workflow over synthetic station inputs and persisted backend state. It does not add real station integrations, networking/offline-sync claims, hardware control, new forecasting science, or a new optimizer. Keep existing project styling and responsive behavior. No database migration is expected for the frontend phase.

## Acceptance evidence

- A fresh UI state explains how to create the first run; navigation does not lose the selected persisted run/plan/session.
- One seeded run can be retrieved with its full hourly telemetry and used to create a linked proposal.
- Proposal review, edit (when feasible), approval, activation, simulated monitoring, and replan approval use the existing API lifecycle.
- Loading, empty, API-offline, validation, and action-error states are understandable and do not fall back to fake operational values.
- Charts and tables use API responses and label simulated time/data; no unsupported forecast confidence is shown.
- Production build and lint pass; manual laptop-size and presentation-size workflow is verified where the UI is available.

## Verified implementation

- The Scenario Simulator, planner, overview, forecast, energy/assets, and decision log now render persisted API records rather than illustrative operational values.
- A 2-day seeded run was verified through the browser at laptop and presentation widths: create run, retrieve 48 hourly records, generate a proposal, review, approve, activate, start monitoring, advance the clock, and inspect observed-versus-proposed charts. The workflow produced no browser console errors.
- Targeted API/planning/monitoring regression tests pass, as do TypeScript compilation, scoped lint (one existing Fast Refresh warning), and the production build.
- Monitoring is available directly from the navigation and Mission Planner handoff. Its desktop first view prioritizes current simulated hour, active-plan state, next action, resource deviations, and a scrollable alert queue; detailed charts and mission progress follow below.

## Current checkpoint boundary

Monitoring can create, present, review, approve, reject, and activate a checkpoint proposal. Once activated, it supersedes the original active plan and ends playback of the original simulation. Continuing playback from the checkpoint state needs a future backend capability; FIRN labels this boundary rather than implying a resumed execution. Timing edits on checkpoint-derived plans are rejected because reconstructing their checkpoint state for an edit would be unsafe.
