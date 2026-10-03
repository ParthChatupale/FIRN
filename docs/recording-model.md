# Recording case: assumptions, derivation and boundaries

This is the browser-local presentation model, not the FastAPI simulator, PostgreSQL schema, optimizer or hardware controller. The original connected workspace remains available through `/?workspace=backend`. No backend data is generated or migrated by this recording case. Shared model: `src/lib/recording-engine.ts`; all presentation routes consume the same state.

## Configuration

A **fictional small coastal summer station** begins 15 January 2026 at 06:00 UTC. The date is a case timestamp, not today's weather. Wind/solar/load forcing is authored, deterministic and uncalibrated; it is not taken from an Antarctic station dataset. Geographic latitude, detailed thermal dynamics, engine start/minimum-load constraints and equipment failure probabilities are not modeled.

| Item                                  | Input                                                          |
| ------------------------------------- | -------------------------------------------------------------- |
| Essential / other base demand         | 32 / 17 kW; demand adds diurnal and cold-weather increments    |
| Wind / PV nameplate                   | 60 / 50 kW                                                     |
| Generator 01 / 02 nameplate           | 80 / 45 kW                                                     |
| Battery / opening / protected reserve | 400 / 312 / 100 kWh                                            |
| Charge / discharge bounds             | 25 / 30 kW; 94% directional efficiency                         |
| Opening / protected fuel              | 1,650 / 300 L                                                  |
| Delivery                              | 1,800 L at baseline H72; recording delay moves arrival to H144 |
| Recording weather                     | H24 onset; 30h front; severity 0.85; adverse allowance 0.30    |
| Observed asset disturbance            | Independent severe derating at H26: Generator 01 → 10 kW       |
| Execution / projection                | Playback H0–H48; projections can extend through delivery       |

## Inspiration is not calibration

The wind model uses cut-in, rated and cut-out behavior. The selected illustrative thresholds (3 / 11 / 20 m/s) are informed by the documented [NREL distributed wind example](https://nrel.github.io/turbine-models/2019COE_DW20_20kW_12.4.html); the cubic curve and 60 kW station capacity are our assumptions, not a reproduction of that turbine's measured performance. Above cut-out, stronger wind can yield zero wind power.

Solar availability uses a stylized summer daylight factor, cloud attenuation and a fixed conversion factor. Hourly weather/temperature/power outputs are familiar in tools such as [SAM PVWatts](https://samrepo.nlr.gov/help/pvwatts_results.html), but this implementation **does not run PVWatts**, use its validated irradiance inputs or model polar sun geometry. This is a compact narrative case, not an engineering sizing model. Local/external separation illustrates an intended [microgrid workflow](https://www.energy.gov/oe/microgrid-systems), not demonstrated islanding or industrial communications.

## What actually evolves

Each point H contains opening battery/fuel inventory and the flows during interval [H,H+1). Resources advance using the previous interval, not the next interval's dispatch:

```text
renewable dispatched + diesel + battery discharge + unserved
    = station demand + running mission demand + battery charge
E[H+1] = E[H] + 0.94 × charge[H] − discharge[H] / 0.94
F[H+1] = F[H] − engine consumption[H] + arrival delivery
```

Engine fuel is an illustrative affine operating curve: running Generator 01 consumes `1.1 + 0.24 × kW` L/h; running Generator 02 consumes `0.7 + 0.25 × kW` L/h. Idle terms are zero for a stopped generator. Available fuel bounds output. Renewable curtailment is explicit; renewable share of total supply must not exceed 100%. Essential demand receives accounting priority; a partly unserved mission interval does not count as completed work.

Observed points are appended only by explicit clock advancement. Changing future inputs leaves observations unchanged. Observing weather/derating or activating a plan changes the **current interval's flows**, not its opening inventory or earlier intervals. Completed mission hours are counted from executed observations, not from a scheduled finish time. A generator event captures the issued pre-event reference so later approval cannot erase the deviation.

Future environmental assumptions and observed events are separate. Preview/apply never injects weather. Observed weather changes local forcing once, with no second multiplier. Derating is independently injected; it is not caused automatically by weather. Playback stops at the weather checkpoint and pauses on pending preparation/proposals or a required planning response. Reset writes only `firn:presentation:v3`; legacy and backend workflow keys are not deleted.

## Preparation, publication and attention

`src/lib/recording-workflow.ts` wraps the pure interval model with shared lifecycle state. Proposal generation has a 2.5-second minimum visible interval, forecast publication 1 second, and asset assessment 1.2 seconds. These are configurable presentation pacing, not measured backend performance. UI elapsed time does not advance station time. Input receipt precedes forecast readiness; generator observation precedes assessment. No joint result/comparison is published before an explicit Generate request completes. Previously published forecast inputs remain visible during refresh.

Input changes and reset invalidate pending work; completion tokens bind results to their input basis and station hour. Failed/interrupted work supports retry. Notifications carry stable IDs, sequencing, station time, input basis and relevant plan version. Acknowledgement marks seen, not resolved or approved. Conditions use remaining conflicts and actual weather thresholds; event history retains prior notices. Authorization controls exist only in Mission Planner.

## How proposals and bands are derived

Priority-first bounded schedule search evaluates integer starts within authored earliest/deadline windows. It excludes instrument-team overlap and unusable field weather, replays dispatch against adverse inputs, and scores candidates on modeled fuel plus deviation from original timing. Essential/high-priority work is placed before flexible work. Energy-first explicitly defers flexible missions. Executed work is retained; remaining in-progress duration is scheduled from the current clock.

This is **not a MILP solve, AI reasoning engine or proof of optimality**. The backend planner is not called. Final assessment checks conflicts, priority-work deferral, weather limits, unserved demand and adverse fuel buffer; infeasible proposals cannot be approved. Review/approval/activation are distinct browser-local records. This is not a production safety certification or authenticated industrial command.

The weather chart's nominal/adverse band comes from two explicit parameter sets: the adverse case increases event severity modestly, reduces renewable availability by the selected allowance, and increases base demand. It is **not a statistical confidence interval**, a trained prediction or measured forecast accuracy. A worse nominal outlook and a wider uncertainty allowance are distinct inputs.

## Generated recording outcome

Reproduce with:

```powershell
node --experimental-strip-types scripts/export-recording-case.mjs --output docs/verification/recording-case/data.json
```

The fifteen-checkpoint export includes applied and published inputs, preparation, attention, current state, schedule, proposal/limits, full observed prefix, projected hourly slab, environmental outlook, decision lineage and connection clocks. Completion intervals are supplied logically by the exporter; this is not a browser timing test. UI values are not copied from an unrelated spreadsheet.

| Checkpoint                   | Active plan     | Opening battery / fuel | Nominal fuel before delivery |
| ---------------------------- | --------------- | ---------------------- | ---------------------------- |
| Baseline / H0                | V1 original     | 312 kWh / 1,650 L      | 1,403 L                      |
| Revised forecast ready / H0  | V1 unchanged    | 312 kWh / 1,650 L      | 856 L                        |
| Joint authorization / H0     | V2 weather      | 312 kWh / 1,650 L      | 805 L                        |
| Weather observed / H24       | V2              | 340 kWh / 1,526 L      | 805 L                        |
| Independent derating / H26   | V2; assess first| 340 kWh / 1,498 L      | 740 L                        |
| Adaptive authorization / H26 | V3              | 340 kWh / 1,498 L      | 765 L                        |
| Continuation / H48           | V3              | 240 kWh / 1,170 L      | 765 L                        |

Original schedule has two actual shared-team overlaps. Joint retains all six baseline missions without those overlaps; energy-first defers two. Joint uses more fuel than the original in this case because its dispatch preserves more battery margin; do not narrate a universal fuel-saving advantage. Revised weather shifts field sampling H8→H7. The severe derating branch defers calibration, moves sample preservation to H32 and ends with five completed / one deferred mission and no nominal unserved intervals. Adverse assessment remains above configured reserves, but margins are narrow; this is conditional on these assumptions.

Moderate 25 kW derating needs no replacement in this case. Severe/full loss is assessed first; the operator must Generate a response. Full outage (0 kW) yields a no-go on generation; approval is disabled. Do not change these outcomes into universally successful story cards.

## Connectivity semantics

Connectivity is a non-modal tray, not a blocking modal. Modeled loss leaves the local browser model usable and queues actual local event/decision actions. Reconnection does not acknowledge records or refresh forecast receipt. `Receive forecast` and `Acknowledge records` use independent timestamps; repeated empty acknowledgement is a no-op. Sensor-network adapters and real external synchronization remain intended integrations, explicitly unconnected in Sources. Login/settings are outside this recording workspace and unchanged.
