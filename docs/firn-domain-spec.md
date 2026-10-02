# FIRN Domain Specification

**Status:** Initial domain contract for Phases 0–1  
**Version:** 0.1  
**Last updated:** 2026-10-01

This document defines the problem FIRN is intended to address, the station domain represented by the current simulator, and the contract future forecasting, optimization, API, and UI work must respect. It is grounded in the current implementation, not a claim that every listed capability is already implemented.

## 1. Product definition and claim boundary

FIRN is decision-support software for coordinating research missions with the energy, fuel, weather, asset, and shared-resource limits of a remote polar station. It should let an operator understand the current simulated station state, compare feasible operating alternatives, see the consequences and reasons for a proposed plan, and retain authority over approval and activation.

**Central hypothesis:** under uncertain weather and constrained energy/fuel, a plan that jointly schedules mission activity and station resources can improve mission value and/or resilience compared with planning missions first or energy first in isolation. This is a hypothesis to evaluate against matched baselines, not an established result.

FIRN’s distinguishing proposition is the integration of mission requirements, station energy and fuel, uncertainty, operational constraints, and operator review. No individual forecast, optimization method, dashboard, or AI technique is claimed as uniquely novel by itself.

### What the current project is—and is not

- The current station, configurations, weather trajectories, and mission examples are **synthetic engineering assumptions**. They are not calibrated against a specific Antarctic station, dataset, or telemetry stream.
- The present Python engine is a repeatable scenario simulator. It is not yet a forecaster, optimizer, operational control system, or synchronized digital twin.
- “Digital-twin direction” describes a future ambition. A defensible twin claim would require a defined physical counterpart, validated model fidelity, and synchronization with observed state at a declared frequency. FIRN currently has none of those connections.
- The operator remains responsible for reviewing and approving plans. Future automated recommendations must not directly actuate physical equipment.

## 2. Operating model

The intended decision loop is:

1. **Describe the operating context:** station state, asset availability, fuel and resupply, weather information/uncertainty, mission requests, and operational constraints.
2. **Assess alternatives:** propagate candidate mission schedules through resource and scenario trajectories; identify infeasibility, shortfalls, risks, and trade-offs.
3. **Propose:** present a time-indexed plan and its assumptions, objective breakdown, and binding constraints.
4. **Review:** allow an operator to inspect alternatives, modify inputs or timing, and compare impacts.
5. **Approve explicitly:** preserve proposal and approval history; activation is never implicit.
6. **Monitor and reconsider:** compare simulated/observed state with the active plan. A significant change may create a new proposal, while the previously approved plan remains active until a person approves a replacement.

The current simulator covers only a simplified form of step 2: it executes a supplied, fixed mission schedule and records hourly outcomes. It does not choose or move mission start times, generate an optimized operating plan, or implement the plan lifecycle above.

## 3. Reference station archetype

Use **Polar Station Alpha**, a fictional, year-round polar research station with a hybrid electrical supply (wind, solar, battery storage, and backup generators), prioritized station loads, limited liquid fuel, periodic resupply, and research/field missions competing for power and shared equipment/personnel.

This hybrid archetype is useful for exploring the planning problem; it must not be represented as a copy of Mawson, Princess Elisabeth, or another real station. Real stations demonstrate a range of architectures: Australian Antarctic Program material describes diesel generation and renewable contributions at particular stations; Mawson uses wind alongside diesel; Princess Elisabeth describes renewable generation, battery storage, backup generators, and prioritized demand. These are examples of operating patterns, not evidence for Alpha’s capacities or parameters. [Australian Antarctic Program: Power generation](https://www.antarctica.gov.au/antarctic-operations/stations-and-field-locations/amenities-and-operations/power-generation/), [Mawson wind power](https://www.antarctica.gov.au/antarctic-operations/stations-and-field-locations/amenities-and-operations/renewable-energy/wind-power/), [Princess Elisabeth micro smart grid](https://www.antarcticstation.org/station/smart_grid/), [Princess Elisabeth renewable energy](https://www.antarcticstation.org/station/renewable_energies/)

Those references support modeling interacting generation, storage, prioritized demand, logistics, and operator-facing monitoring. They do **not** validate FIRN’s numerical values, weather generator, dispatch policy, or mission assumptions. Numeric defaults below are prototype inputs selected to exercise the model and must be replaced or calibrated only when suitable evidence is obtained.

## 4. Domain entities and current synthetic defaults

| Entity | Meaning | Current implementation / default |
|---|---|---|
| Station | The modeled operating site and its configured resources | `Polar Station Alpha`; 35 kW solar and 55 kW wind nameplate capacity |
| Electrical load | Requested station or mission demand in a timestep | 28 kW critical, 22 kW essential, 10 kW flexible baseline loads; weather-sensitive heating is added to essential load |
| Generator | Dispatchable electrical source with availability, output bounds, and fuel rate | Two generators: 100/80 kW maximum, 18/15 kW minimum, initially available; each defaults to 0.28 L/kWh |
| Battery | Finite electrical storage with reserve, power limits, and conversion efficiency | 360 kWh capacity, 270 kWh initial energy, 90 kWh reserve, 75 kW charge, 60 kW discharge, 94% charge/discharge efficiency |
| Fuel inventory | Liquid-fuel quantity available to generators and some missions | 3,000 L initially, 10,000 L tank capacity; configured delivery is 6,000 L, subject to available tank space |
| Resupply | Scheduled delivery of fuel | Default arrival at hour 288 (day 12); scenario builder may move it to the final simulated hour for shorter runs |
| Weather state | Synthetic hourly environment used by generation, heating, and mission checks | Clear/cloudy/storm regimes generated from the run seed; not a forecast or observed station weather |
| Mission | A scheduled activity with a fixed start, duration, electrical demand, priority, requirements, and optional non-electric fuel use | Example missions include ice-core analysis, water production, field survey, and sample processing |
| Equipment/personnel requirement | Named shared resource required by a mission | String identifiers only; current engine prevents overlapping use of the same identifier but has no richer asset inventory or qualification model |
| Event | Exogenous scenario change | Storm window, generator failure/recovery, or resupply delay |
| Simulation run | One execution of a configuration under a seed and start time | In-memory result containing summary, hourly telemetry, event log, and mission results; not yet persisted in PostgreSQL |
| Plan | A proposed, reviewed, approved, or active set of decisions | Future domain object; no optimizer or plan lifecycle is implemented yet |

### Current sample missions

The baseline examples use small, synthetic activities: 8 kW for 4 h (ice-core analysis), 12 kW for 2 h (water production), 6 kW for 3 h (field survey, including 18 L non-electric fuel), and 5 kW for 2 h (sample processing). A separate stress case requests 80 kW for 4 h, i.e. 320 kWh of electrical energy when fully served. These are test fixtures, not operational recommendations or empirical station loads.

### Priority semantics

The current engine serves station critical load first, then essential load (including modeled heating), then eligible missions ordered by their configured priority, then flexible station load. Critical/high/medium/low mission priorities are currently an ordering convention, not a complete policy model or a guarantee that every “critical” mission outranks station essential demand. Missions are all-or-nothing per simulated hour in the current engine. The future planner must define priority and interruptibility semantics explicitly and must not silently reinterpret these current mechanics.

## 5. Time, units, and state evolution

- Simulation time advances in **one-hour discrete steps**. `start_time` is an ISO-8601 datetime; timestamps should retain an explicit UTC offset. The default start is `2032-01-01T00:00:00+00:00`.
- Scenario `hour` values are zero-based offsets from the configured start time. For example, hour 24 is one day after the start. Durations are expressed in hours; the active interval is start-inclusive and end-exclusive.
- Electrical power is kW; energy and stored battery energy are kWh; fuel is litres; temperature is °C; wind speed is km/h; visibility is km; timestamps are ISO-8601.
- With a one-hour timestep, kW numerically corresponds to kWh for energy integrated over that full timestep, assuming the modeled value is constant for the hour.
- Each run begins from its immutable input configuration. Battery energy, fuel inventory, generator availability, mission state, storm windows, and resupply state then evolve hour by hour. Output is an hourly trajectory plus event and mission records.
- A fixed seed is intended to reproduce a run exactly for the same simulator version and configuration. Reproducibility across future simulator versions is not guaranteed unless versioned explicitly.

## 6. Synthetic environment and generation model

The current engine creates weather for the whole run using a seeded pseudo-random regime process. Weather regimes are held in six-hour blocks; clear, cloudy, and storm regimes use hand-authored temperature, wind, visibility, solar, and wind-generation factors. A storm event forces storm weather for its configured interval. Solar availability follows a simplified daily UTC daylight curve; wind output is scaled by a regime factor and wind speed, with turbine output cut off at wind speeds of at least 90 km/h.

The weather values and transition behavior are illustrative assumptions, not Antarctic climatology, a physical weather model, a forecast, or calibrated probability distributions. Scenario outputs must be labeled **synthetic**. The weather model should be replaced or calibrated only through a documented data-selection and validation process.

Heating demand is a simplified linear proxy: `max(0, reference_temperature - ambient_temperature) × heating_kW_per_degree`, added to essential demand. It is not a building heat-loss or cogeneration model. Generator waste heat, thermal storage, water production physics, fuel quality/temperature effects, and electrical network losses are outside the current boundary.

## 7. Simulator contract and accounting boundary

The simulator receives a station configuration, fixed mission schedule, scenario events, run duration, start time, and random seed. It returns hourly telemetry, event records, mission outcomes, and aggregate summary. Its responsibility is to execute those supplied inputs and record consequences—not to decide which schedule is best.

At the modeled electrical bus, the current hourly accounting is:

`renewable generation + generator generation + battery discharge = served loads + battery charging input + curtailed energy`

Battery conversion losses are reported separately from the bus balance. Battery state changes account for charge/discharge efficiency; fuel changes with generator output and non-electric mission fuel use; resupply increases inventory up to tank capacity. Unserved demand remains visible as shed load or a mission power shortfall; it must not be disguised as served energy. This is a simplified balance, not a full AC network or thermodynamic balance.

The current dispatch implementation uses renewable generation first, dispatches configured generators to the remaining total demand (within their simplified output bounds), then uses battery discharge for any residual shortfall subject to reserve and power limits. Load service is then allocated in priority order. This is an implementation choice for the baseline simulator, not a claim that real stations universally dispatch resources this way or an optimizer’s solution.

Telemetry should at minimum preserve timestamp, weather, available renewable output, generator output/status, requested and served load by category, battery state and power, fuel inventory and use, resupply status, mission state, curtailment, and accounting error. API persistence should retain the exact input/configuration snapshot, seed, scenario, simulator version, outputs, and events so a run can be reproduced and audited.

## 8. Mission and shared-resource model

Today, missions have a fixed start hour and duration, constant electrical power while active, a priority, required equipment/personnel identifiers, simple minimum-visibility and maximum-wind thresholds, and optional one-time non-electric fuel consumption at start. Equipment/personnel collisions are checked among scheduled activities. A mission can be rejected for a weather/resource conflict or fail if its electrical demand cannot be served during an active hour; the current model does not move it to another time.

The future planning model must state which mission properties are mandatory, optional, or preferences. In particular, it must define deadlines and windows, duration and power profiles, precedence/dependencies, partial completion and interruption, setup/teardown, resource qualification and availability, mission value, and weather uncertainty. Until added and tested, these are not supported capabilities.

## 9. Future planning contract

The optimizer will propose a schedule and resource plan; it will not be conflated with the simulator. Candidate plans must be evaluated by the same simulator, initial state, scenario, and random seed when compared.

### Hard feasibility constraints

The planned system must treat at least the following as hard constraints unless an operator explicitly configures a documented emergency mode: critical-load service policy; generator availability and minimum/maximum output; battery capacity, charge/discharge power, and protected reserve; fuel non-negativity and tank capacity; resupply timing/capacity; equipment and personnel exclusivity/qualification; mission weather limits and required duration; and any station-defined safety or environmental limits. If a simulation is deliberately testing failure, violations must be reported explicitly rather than relabeled feasible.

### Soft objectives and trade-offs

Subject to hard feasibility, the plan may trade off mission/science value and completion, lateness, fuel consumption and fuel remaining before resupply, renewable curtailment/use, generator runtime/start burden (once modeled), reserve margin, exposure to uncertainty, and plan stability. Objective weights and units must be visible to the operator. No single weighted score should hide critical violations or make the result uninterpretable.

## 10. Evaluation contract

The central comparison uses three transparent planning baselines:

1. **Schedule-first:** choose a mission schedule using mission preferences/constraints without jointly optimizing station energy; then simulate dispatch and report any resulting resource shortfall.
2. **Energy-first:** choose an energy-feasible operating trajectory first, then schedule missions into the remaining feasible windows.
3. **Joint FIRN:** choose mission timing/selection and energy/resource decisions together under the same stated constraints and uncertainty information.

The exact algorithms must be documented before benchmarking, and each baseline must be given the same station configuration, initial state, candidate mission set, scenario trajectory, seed, and information horizon. If a baseline cannot produce a feasible plan, record that outcome rather than dropping the run. A perfect-information solution may be shown only as an analytical upper bound, not as a deployable baseline.

Primary reported measures:

- completed mission/science value and mission completion fraction;
- mission lateness and rejected/deferred activity;
- fuel consumed and fuel remaining at/before resupply, including any depletion event;
- critical-load shortfall and battery-reserve violations, separately and explicitly;
- renewable energy used/curtailed and generator runtime/output;
- plan changes or churn after monitoring/replanning exists;
- runtime, infeasibility rate, and relevant forecast/scenario assumptions.

Report distributions across multiple paired seeds/scenarios, not only one favorable run. Keep raw run inputs and result summaries to support reproduction. Do not claim superiority until these comparisons have been run and reviewed.

## 11. Scope boundaries and staged capabilities

**In scope for the near-term system:** a single synthetic hybrid station; repeatable, explicit scenarios; mission/resource constraints; weather and asset events; energy/fuel trajectory; transparent baseline comparisons; an operator-reviewed proposed-plan workflow; and persisted, versioned simulation results.

**Deferred unless evidence or project needs justify them:** live station telemetry and physical control; multi-station logistics; high-resolution weather prediction; detailed AC power flow and thermal networks; cogeneration and water-process physics; battery degradation/electrochemistry; startup/ramp/minimum-up/down generator dynamics; sophisticated demand response; advanced AI/ML; and autonomous plan approval.

## 12. Digital-twin terminology

NIST notes that “digital twin” has no single universally accepted definition and discusses real-time/bidirectional exchange and lifecycle synchronization as features associated with digital-twin systems. FIRN should therefore describe its current work as a **synthetic station simulation / digital-twin-oriented decision-support prototype**, not as a digital twin of a real station. [NIST: Digital-twin definitions and state of the art](https://www.nist.gov/digital-twins/definitions-and-state-art), [NIST IR 8356](https://doi.org/10.6028/NIST.IR.8356)

A future twin claim would require (at minimum): a named asset/system boundary; traceable configuration provenance; measured inputs and timestamps; an explicit synchronization cadence and data-quality/staleness handling; validation of model behavior against observations; versioned predictions with uncertainty; and governed human decisions/actions. A live connection alone would not establish model validity.

## 13. Known simulator gaps to audit before trusting results

The following are visible limits or required checks, not assumed solved by this specification:

- Verify timestep accounting and the treatment of battery conversion losses, including the exact modeled boundary.
- Test generator minimum output, sequential dispatch, fuel exhaustion, and state continuity at every hour; verify whether failed or unavailable generators behave as intended.
- Test that different seeds change weather while identical seeds/configuration reproduce the complete output.
- Test weather rejection and mission power shortfall, equipment/personnel conflicts, fuel requirements, and whether failed missions continue to consume resources.
- Test whether an added high-power mission changes downstream battery/fuel/resource trajectories, not merely its own reported energy total.
- Clarify overlapping storm events, resupply delays after delivery, deliveries beyond the run horizon, and partial tank capacity.
- Add or explicitly defer generator startup/ramp constraints, low-battery events, deadlines, interruptibility, mission power profiles, heat recovery, and richer asset states.
- The UI currently contains hardcoded product data; database persistence, API integration, optimization, forecasts, plan approval lifecycle, and monitoring remain future work.

The Phase 2 simulator gap report should turn these into testable pass/fail findings and distinguish acceptable simplifications from defects before simulation results are treated as trusted optimizer inputs.
