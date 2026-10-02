# Phase 4 optimization prototype

**Status:** Phase 4 prototype exit checks are implemented and tested. This remains a deterministic synthetic decision-support prototype, not an operational controller or final planner.  
**Updated:** 2026-10-02

## Solver and setup

The planner uses **Pyomo** with **HiGHS** through `appsi_highs`. Both it and **OR-Tools** are optional dependencies under the `optimization` extra. Pyomo/HiGHS stays the planner pairing because the main model includes continuous kW/kWh/fuel quantities. OR-Tools CP-SAT is an alternative for integer scheduling, benchmarked on the exact same integer-only model below; that benchmark is useful evidence, but does not establish a universal or production solver winner. [Pyomo documentation](https://pyomo.readthedocs.io/en/stable/) · [Pyomo APPSI / HiGHS interface](https://pyomo.readthedocs.io/en/stable/reference/topical/appsi/appsi.html) · [HiGHS Python interface](https://ergo-code.github.io/HiGHS/stable/interfaces/python/example-py/) · [OR-Tools CP-SAT](https://developers.google.com/optimization/cp/cp_solver)

From the repository's project environment, install the optional dependencies with:

```powershell
uv pip install --python C:\FIRN\.venv\Scripts\python.exe -e ".[optimization]"
```

The WSL test environment used for this run has Pyomo 6.10.1, HiGHS Python interface 1.15.1, and OR-Tools 9.15.6755. The benchmark runs each solver in a separate child process so their native libraries cannot interfere with each other.

## Prototype boundary

The public entry point is `backend.optimization.optimize_schedule(config, ...)`. It accepts the existing simulation configuration, optional candidate mission start hours, optional mission values, and optionally an explicit hourly `WeatherForcing` trajectory. If no forcing is given, it obtains the deterministic weather and renewable trajectory by running the existing simulator with the same configuration and seed.

By default, each mission may start at any whole hour within ±12 hours of its existing scheduled hour, bounded by the run. Callers can pass `start_options` to define explicit candidate hours. A mission is optional: the model can leave it unscheduled. Existing mission priority is represented by a transparent score (critical 4, high 3, medium 2, low 1). Explicit positive `mission_values` may override those scores; the values are inputs, not inferred science worth.

### Decision variables and constraints

- Binary mission-start variables select at most one permitted start per mission; weather-ineligible start choices are removed before solving.
- Resource exclusivity prevents overlapping missions from using the same equipment or personnel identifier.
- Generator commitment uses on/start/stop binaries. Output respects minimum and nameplate power, per-hour ramp-up/down limits, initial on/off state and elapsed duration, minimum up/down times, startup fuel, configured failures, and initial unavailability.
- Renewable use cannot exceed the existing simulator's hourly solar-plus-wind trajectory.
- Hourly energy balance must serve all configured station base load and every selected mission. There is no load shedding in this prototype.
- Battery state of charge follows the configured charge/discharge efficiency, charge/discharge power limits, capacity, and protected reserve. A binary operating mode prevents simultaneous charging and discharging.
- Battery state must finish at or above a terminal target. The default target is its initial state of charge; callers may supply another target between reserve and capacity.
- Fuel inventory evolves hourly, remains within tank limits, includes generator consumption and startup fuel plus mission non-electric fuel, and receives the scheduled shipment subject to remaining tank capacity.
- A `RESUPPLY_DELAY` event shifts the arrival hour when it occurs before the currently predicted arrival, matching the simulator's event ordering. Multiple delay events are applied in chronological order.

The objective is solved lexicographically: first maximize the priority-weighted mission score; then hold that score fixed and minimize generator fuel. The returned plan includes the selected mission schedule, hourly proposed dispatch, objective breakdown, solver status, and a replay of the chosen schedule through the existing simulator.

Optional `latest_finish_hours` rules constrain mission completion by an inclusive hour boundary. Optional `precedence` pairs `(predecessor_id, successor_id)` require the predecessor to be selected whenever the successor is selected, and require it to finish before the successor starts. These are explicit caller-supplied planning rules; they are not inferred from mission names or station doctrine.

For uncertainty-aware planning, callers may pass `weather_scenarios`, a mapping of at least two names to hourly weather trajectories. FIRN builds one conservative hourly envelope: minimum renewable output, coldest temperature, lowest visibility, and highest wind across the supplied paths. The same mission schedule must be feasible against that envelope. This is deterministic stress planning—not a probability distribution, expected-value forecast, or multistage recourse model. The returned independent simulator replay uses the first scenario name in sorted order, and is labeled separately from the robust MILP dispatch.

The named synthetic station scenarios use explicit illustrative generator settings: gen-1 ramps at 60 kW/hour, gen-2 at 50 kW/hour; both use a 3-hour minimum-on time, 2-hour minimum-off time, and small startup-fuel allowance. These values are software test assumptions only, not Antarctic equipment specifications. Generator commitment fields constrain the MILP; the simulator replay remains a separate heuristic dispatch and does not emulate those commitment dynamics.

Infeasible solves now return targeted likely power bottlenecks (where baseline demand exceeds instantaneous renewable, available generator, and battery discharge power), missions with no remaining weather/deadline-valid start, and the supplied precedence rules. This is an aid to investigation, **not** a solver IIS and not guaranteed to identify the cause when infeasibility is due to cumulative fuel/SOC or an interaction across constraints.

## Important limitations

- The current simulator's dispatch policy is not the MILP dispatch policy. The MILP schedule is a proposed dispatch; replay changes the mission schedule but lets the existing simulator dispatch generators and battery according to its own rules. Both modeled and replay results are returned, and should be compared rather than conflated.
- **Matched baseline example:** On the normal synthetic 7-day seed-42 case, Schedule-first completed 4/4 missions, consumed 1,774.343 L, and had no unserved energy or critical violation hours. Energy-first (station-only dispatch, then greedy lower-stress window placement) completed 4/4, consumed 1,772.577 L, and had no such violations. Joint FIRN selected 4/4 (priority score 12); its independent simulator replay consumed 1,773.557 L, also with no unserved energy or critical violation hours. Its MILP-estimated fuel was 1,707.993 L. That modeled/replay gap reflects different dispatch policies. This one synthetic matched case shows similar outcomes; it does **not** demonstrate a general advantage for the optimizer.
- **Solver microbenchmark:** `benchmark_solver_candidates()` compares HiGHS and OR-Tools CP-SAT on one common binary mission-start model, with at most two concurrent missions. Each solver runs in its own process to isolate native libraries. The benchmark excludes continuous dispatch, energy storage, and fuel balances; it is not grounds to replace the current planner solver. Solve times are machine- and version-dependent.
- The conservative scenario envelope does not model probabilities, correlations beyond the worst-case hourly envelope, scenario-dependent recourse, forecast calibration, or transition costs between plans.
- Generator start-up duration and a physically detailed shutdown ramp are not modeled. Start fuel and minimum commitment times are explicit; ramp rates constrain output changes while operating and ramp-up at starts.
- The simulator replay does not use the optimizer's generator commitment or battery dispatch, so its trajectory can differ from the modeled dispatch. Compare both results; do not treat replay as proof that the proposed dispatch was executed.
- Explicit empirical science value, interruption handling, detailed generator wear, and operational validation remain out of scope.
- There is no IIS/minimal conflict set, API/UI integration, plan approval workflow, or production operational validation in this phase. The reported diagnostics are targeted clues only.

## Reproduction and tests

```python
from backend.optimization import optimize_schedule
from backend.simulation.scenarios import build_scenario

proposal = optimize_schedule(
    build_scenario("normal", days=7, seed=42),
    flexibility_hours=6,
)
print(proposal["status"], proposal["schedule"], proposal["objective"])
print(proposal["simulator_replay"]["summary"])
```

Optimization tests cover feasible scheduling/replay, weather exclusion, energy infeasibility diagnostics, generator ramp/start/minimum-time constraints, terminal state of charge, delayed resupply, conservative multi-scenario feasibility, deadlines/precedence, matched three-way baselines, and solver objective agreement. The separate PostgreSQL persistence tests are documented in `docs/postgresql-integration.md`. Run `python -m pytest tests/test_optimization.py` in an environment with the `optimization` extra installed.
