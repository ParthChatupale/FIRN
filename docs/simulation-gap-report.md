# FIRN Simulator Gap Report

**Status:** Verification passed against the current synthetic domain contract
**Date:** 2026-10-02
**Scope:** `backend/simulation/` compared with `docs/firn-domain-spec.md`

This is a code-and-test audit of the current standalone simulator, not a validation against Antarctic operational data. The station parameters and weather remain synthetic. Targeted correctness fixes and regression tests were added as part of this audit.

## Executive result

The engine is a deterministic scenario prototype. The audit fixed generator minimum-output handling, fractional timestep inputs, timezone validation, UTC solar timing, and overlapping generator-failure recovery. All 21 simulator tests and 5 API tests pass. A reduced-battery-capacity scenario was added for the frontend and passes its state-bound test. This verifies consistency against FIRN's current **synthetic** contract; it does not validate the parameters or outcomes against a real Antarctic station.

### Classification key

- **Correct (tested):** behavior matches the current contract and has direct evidence.
- **Simplified:** intentionally coarse representation; acceptable only with explicit labeling and scope limits.
- **Missing:** needed for the future planning contract, but absent or not yet tested sufficiently.
- **Defect:** current behavior contradicts a stated simulator invariant or accepts input that cannot be executed correctly at the model timestep.

## Findings

| Area | Classification | Finding and evidence | Priority / next action |
|---|---|---|---|
| Electrical bus accounting | Correct (tested) | The boundary is renewable + generator + battery discharge = served loads + battery charge input + curtailment. Maximum reported hourly balance error was 0.0 kW in 30-day runs of all five named scenarios (normal, storm, generator failure, resupply delay, mission energy). Conversion loss is tracked separately. | Keep invariant tests, including rounding tolerance and non-default efficiencies. |
| Battery SOC and limits | Correct (tested, limited coverage) | In the original five 30-day runs, hourly SOC stayed within reserve (90 kWh) and capacity (360 kWh). The added 30%-reduced-capacity scenario is tested against its scaled 63 kWh reserve and 252 kWh capacity. Existing tests also check no simultaneous charge/discharge. | Add broader tests for exact reserve/capacity boundaries, charge/discharge efficiencies, and custom battery configurations. |
| Fuel and tank bounds | Correct (tested, limited coverage) | Fuel stayed within `[0, tank_capacity]` for hourly telemetry in all five named 30-day scenarios, including resupply. A delivery is capped at available tank space. | Add explicit regression coverage for near-full tank delivery, zero fuel, and fuel consumed at the same hour as resupply. |
| Generator minimum output | Corrected and tested | A generator is now kept off with status `fuel_insufficient_for_minimum` if fuel cannot sustain its configured minimum output for the full hourly step. A low-fuel regression test confirms no fuel is consumed and no below-minimum `running` output is reported. Named stress scenarios no longer violate the minimum-output invariant. The conservative hourly model can leave a small unusable fuel remainder until resupply. | Keep the regression test. If partial-hour operation is later required, model sub-hour dispatch explicitly instead of reporting below-minimum hourly output. |
| Generator capacity and fuel use | Correct in tested named scenarios; missing edge coverage | Outputs in named scenarios stayed within configured maximums and fuel never went negative. The model has no startup, ramp, minimum-up/down, or commitment costs; a dispatch output is an hourly abstraction. | Add property-style bounds tests and document this dispatch simplification. Defer detailed dynamics only if the optimizer contract does not require them. |
| Seed reproducibility / variability | Correct and tested | Fixed-seed regression compares complete result dictionaries; a new different-seed regression confirms that seeds 42 and 43 produce different weather trajectories. | Keep both properties covered. |
| Storm effects | Correct as a stress event; simplified | Existing test confirms the forced storm regime reduces renewable output and defers an exposed mission. In a 30-day storm scenario, the synthetic resource/fuel assumptions led to 14 critical-load violation hours and left fuel below the amount required to run either generator for a full minimum-output hour. This is an explicit failure outcome, not proof that a real station would behave this way. | Keep failure visible. Validate and label scenarios; do not present this trajectory as station-calibrated. |
| Generator failure/recovery | Corrected and tested | Existing test verifies failure, backup dispatch, and recovery. Overlapping failures now preserve the later recovery time; a regression test confirms a shorter second failure cannot cause premature recovery. | Keep overlap test; add boundary coverage for failure at hour 0 and recovery at simulation end. |
| Resupply and delayed delivery | Correct for named integer-hour case; edge handling incomplete | Existing test confirms a five-day delay moves arrival from hour 288 to 408; the delayed scenario records critical violations and leaves a small fuel remainder insufficient for generator minimum output. Delivery after the simulation horizon is accepted but never arrives, and there is no explicit “outside horizon” outcome separate from `resupply_delivered: false`. | Define out-of-horizon semantics and add tests for delay beyond horizon, delay on arrival hour, delay after delivery, and partial tank fill. |
| Fractional event/mission time | Corrected and tested | Event hour/duration, mission start/duration, resupply arrival, and simulation days are now validated as whole hours/days. Resupply delay values must be whole hours. Regression tests reject fractional inputs rather than accepting values the hourly loop cannot represent. | Keep validation aligned if timestep resolution changes. |
| Mission energy/resource effect | Correct and tested | In a three-day `mission_energy` run (seed 12), the 80 kW × 4 h mission required and received 320 kWh. A paired same-seed run with the mission removed differed in both hourly battery and fuel trajectories; the regression test protects this consequence, not only the mission's own energy total. | Keep the paired trajectory test. |
| Mission scheduling and priority | Simplified by design | The simulator executes fixed start times; weather/resource-ineligible missions are deferred and not rescheduled. Mission demand is all-or-nothing each hour. Station critical and essential loads precede all missions; mission priority only orders missions relative to each other. No mission deadline, partial execution, interruption policy, or objective value exists. | Keep simulator/planner distinction explicit. Define mission semantics before the optimizer is implemented. |
| Mission weather / resource conflicts | Correct for tested cases; missing boundary coverage | Current tests cover a weather-based defer and simultaneous equipment/personnel collision. Active mission weather interruption and fuel competition between multiple same-hour starts are not directly tested. | Add tests for mid-mission weather interruption, shared personnel collision, simultaneous non-electric fuel reservations, and energy shortfall after a mission starts. |
| Timestamp validation and solar clock | Corrected and tested | Start times require an explicit UTC offset. The solar daylight curve now uses UTC rather than the local wall-clock hour; equivalent instants represented in UTC and +05:30 produce the same solar trajectory. Tests cover naive timestamp rejection and offset equivalence. | Keep UTC convention explicit in API serialization and UI rendering. |
| Numeric/config validation | Improved; residual coverage remains | Core configuration numbers are checked for finiteness; seeds and timestep fields are type-checked, and event/mission enums are validated. Tests reject a NaN solar capacity. Resource identifier type/emptiness, boolean fields, and all malformed nested input shapes are not exhaustively validated yet. | Add edge cases as external input becomes user-configurable. |
| Weather realism | Simplified | Seeded clear/cloudy/storm regimes and hand-set ranges provide repeatable scenario variation, not observed weather, calibrated climatology, or forecast probabilities. Solar follows a simplified daily UTC sine curve and wind is a hand-authored factor with a cutoff. | Acceptable for a synthetic prototype only. Document assumptions; replace/calibrate through a separate data and validation task before making forecast claims. |
| Thermal and station physics | Simplified / deferred | Heating is a linear temperature proxy. No building thermal state, cogeneration, generator heat recovery, water-system physics, network losses, or storage degradation is represented. | Keep excluded until the product boundary and evidence justify these models. |
| Persistence / API | Implemented in Phase 2; live path verified | FastAPI executes this engine and persists input snapshots, summaries, mission outcomes, events, and hourly telemetry in PostgreSQL. A local 30-day run was created and retrieved through the API, with all 720 telemetry rows verified in PostgreSQL. Automated API tests use isolated SQLite; a separate automated PostgreSQL integration test remains a hardening follow-up. | Keep the engine separate from persistence. Add PostgreSQL integration automation when a dedicated test database is available. |
| Forecasting / optimization / plan lifecycle | Missing, planned | The engine executes fixed mission schedules and baseline dispatch; it does not forecast from observed data, optimize alternatives, approve plans, or monitor live operations. | Future phases; do not describe the current simulator as an optimizer or digital twin. |

## Verification performed

1. Inspected `models.py`, `engine.py`, `scenarios.py`, and `tests/test_simulation.py` against the domain specification.
2. Ran the Windows Python 3.14 test suite. **26 tests passed** (21 simulator and 5 API tests), including CLI JSON output and isolated SQLite persistence/retrieval.
3. Attempted the same suite under WSL; the WSL service returned `E_ACCESSDENIED` before Python could run. WSL results therefore remain unverified here.
4. Ran direct probes across the five original named scenarios for 30 days at seed 42. Bus-balance max error was 0.0 kW; SOC and fuel stayed within configured bounds. The generator-minimum issue in storm and resupply-delay scenarios was reproduced, fixed, and covered with a low-fuel invariant test.
5. Compared same-seed three-day mission-energy runs with and without the 80 kW mission; confirmed 320 kWh served and changed battery/fuel trajectories.
6. Compared normal scenarios at seeds 42 and 43; telemetry differed.
7. Probed low-fuel generator operation, fractional failure duration, overlapping failures, naive timestamps, and timezone-equivalent solar output; fixed the reproduced defects and added regression tests.
8. Added and tested a synthetic 30%-reduced battery-capacity scenario so the Scenario Simulator's low-battery selection maps to a real backend simulation input.

The Windows Python 3.14 suite passes: **26 tests passed**. WSL execution remains unavailable in this agent session (`E_ACCESSDENIED` before Python starts), so no WSL test result is claimed.

## Recommended fix-and-test order

1. Add further boundary tests for resupply at/after the horizon, mid-mission weather interruption, same-hour fuel competition, and malformed nested/resource identifiers as those behaviors become relevant to API/optimizer inputs.
2. Revisit conservative stranded-fuel behavior if partial-hour generator dispatch is required by the selected operating model; do not silently relax generator minimums.
3. Calibrate or replace synthetic weather and station parameters before making real-station or digital-twin validity claims.

## Gate decision

**Simulator verification against the current synthetic domain contract: PASSED.** The confirmed dispatch, timestep, overlapping-failure, and timezone defects have fixes and regression coverage; the complete 20-test suite passes. Remaining items are documented modeling limitations or additional boundary coverage, not known failures in the tested contract. Outputs may now be used to develop and compare planning logic **within this synthetic simulator**, but must not be represented as calibrated real-station predictions. The broader Phase 2 backend/API exit gate remains separate and incomplete.
