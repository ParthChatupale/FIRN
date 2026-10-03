# FIRN recording script — operator workflow

Status: narration/actions aligned with the implemented recording case. Use this as the rehearsal script; final visual acceptance and recording remain with the user. This replaces the earlier ten-scene numbering.

Before the app walkthrough, use a brief disclosure outside the operating panels:

> This walkthrough uses a controlled station simulation to demonstrate FIRN’s decision-support workflow. Station values and external connectivity are modeled; no physical equipment is controlled.

Team introduction is separate. One case, one operator, one continuous clock. The fictional coastal summer case begins **15 January 2026, 06:00 UTC**. H0 is elapsed time, not a date. The continuation checkpoint is **H48 / 17 January 06:00 UTC** so the final view includes the remaining mission outcomes. Do not describe this as one operating day.

## 1 — Hook: enough energy is not enough

**Visual:** Transition from polar mission imagery to Operations.

> A polar station can have enough energy to keep its lights on—and still lose its mission. A field team needs a usable weather window. Laboratory work needs equipment and power. Essential services cannot simply be switched off, and fuel has to last until resupply. These are not separate decisions. FIRN brings them together.

## 2 — Establish the operating picture

**Action:** Operations, H0 / original schedule V1. Indicate current weather, supply, reserve, fuel, delivery and mission windows; do not read every metric.

> As the operator, I need to know what is available, what is committed, and where our margin is. Current conditions and the active plan share one operating picture. Observations show what is happening now; the outlook shows what that plan expects next.

Current resources are **312 kWh / 1,650 L**. These are case inputs, not a claim about a real station. V1 is the prepared original schedule, not a joint plan already approved on camera.

## 3 — Show the station case, not an event slideshow

**Action:** Scenario Simulator → Applied outlook. Briefly select weather or resources. Keep future draft controls unapplied.

> Here is the station case behind those views: weather, generation, demand, storage and mission commitments on the same clock. We can examine a future operating condition without changing the station’s current readings.

The current-state slab remains visible. Input preview is explicitly a draft; it must not be narrated as observed telemetry.

## 4 — Why joint planning matters

**Action:** Mission Planner → Original schedule → Energy-first → Joint mission–energy. Hold on schedule + dispatch.

> Keeping the original timing is one option. Deferring flexible scientific work is another. But fuel alone does not tell us whether the mission can be delivered. People, equipment and weather windows also have to line up. Joint planning coordinates those commitments with energy dispatch and protected reserves.

**Visible evidence:** original has two instrument-team overlaps; energy-first defers two flexible missions; joint schedules all six without overlap. Joint is not claimed to use less fuel than both alternatives.

## 5 — Human authority, not autonomous control

**Action:** Generate joint proposal V2 → Review proposal → Approve plan → Activate V2. Brief Operations view.

> Selecting a comparison is not authorizing it. I inspect the proposed schedule and limits, approve the recommendation, and explicitly activate it. The previous plan stays in force until that final action.

Joint planning starts in scene 4. Forecast assumptions already inform it; the dedicated forecast presentation starts next.

## 6 — Introduce the forecast before changing it

**Action:** Look ahead, baseline renewable outlook and nominal/adverse range.

> A plan depends on what may happen next. We inspect expected renewable availability and a separate adverse operating assumption—not one apparently certain future. That outlook feeds the mission and resource decisions we have just reviewed.

The band is an **assumption envelope**, not learned prediction accuracy or a calibrated confidence interval.

## 7 — Change the future, not the past

**Action:** Simulator → Recording case → Input preview; show weather/resources → Apply future assumptions. Preset: resupply +3 days, front H24, severity 85%, adverse renewable allowance 30%.

> Now the delivery estimate slips, and the weather outlook deteriorates. The station has not suddenly lost fuel or battery energy. Its future has changed. I preview that logistics update and weather condition, then apply them to the same station case.

Delivery changes **18 January → 21 January**. Delay is supplied logistics information, not magically inferred from a weather sensor. Current inventory stays unchanged.

## 8 — Connect forecast to consequence

**Action:** Look ahead → Operations; indicate renewable decline, field opportunity, arrival and resource exposure.

> Stronger wind does not always mean more usable generation: above the configured cut-out, wind production falls. Cloud cover also reduces solar output, while colder conditions increase modeled heating demand. Together with the longer wait for resupply, this changes the exposure of our active schedule.

Technically: versioned future assumptions drive environmental forcing, load and resource recurrence. Uncertainty allowance is explicitly changed; bad weather alone does not prove increased model uncertainty.

## 9 — Joint planning responds to that outlook

**Action:** Planner → Generate V3; compare active/proposed field timing and resource trajectory → Review → Approve → Activate.

> A changed forecast does not authorize a changed plan. FIRN proposes an earlier field window and checks the revised mission-and-energy schedule against the updated assumptions. We inspect the trade-off and put the revision into operation deliberately.

Field sampling moves **H8 → H7**. Do not say every mission moves: unchanged commitments remain unchanged. Forecast and joint planning are one connected workflow, not separate staged systems.

## 10 — An expectation becomes an observation

**Action:** Monitoring → To weather H24 → Observe weather event. Brief Simulator weather view or Operations.

> Now we advance the station to the weather event. These are current observations, not just future assumptions. Weather, available renewable output, heating demand and resource inventory evolve together. Earlier observations and completed work remain intact.

Expected arrival is not inherently a forecast failure. The event is applied once; the future outlook does not multiply the observed reduction a second time.

## 11 — The independent generator scene

**Action:** Monitoring → To asset checkpoint H26 → Apply generator derating. Inspect output/reference and capacity.

> Weather is not the only uncertainty. Generator 1 now loses most of its available capacity. The question is whether the remaining generation, battery and mission commitments can still coexist—not simply whether an alarm appeared.

Recording case is **80 → 10 kW available** for Generator 1, with Generator 2 still **45 kW**. This is severe derating, not a total outage. The pre-event reference remains visible after replacement activation.

## 12 — An adaptive decision, even with the external link lost

**Action:** Connectivity → Model external outage → close tray. Review V4 → Approve → Activate. Show proposed calibration deferral and sample timing.

> The remaining-work proposal keeps completed missions completed, defers flexible calibration, and moves sample preservation to a viable window. I retain the final decision. Here we also model a separate external-link interruption: the local case workspace remains usable, while those decisions wait in its outbox.

Calibration is deferred; sample preservation starts **H32**, not the earlier placeholder H33. No real browser offline, station-to-HQ sync, production safety gate or network-test claim.

## 13 — Continue, then restore each external operation separately

**Action:** Monitoring → +6h three times → +1h four times, reaching H48. Connectivity → Restore uplink → Acknowledge 4 records; separately Receive forecast.

> We continue under the authorized response. When the modeled link returns, decision acknowledgements and forecast receipt are separate operations. Restoring a connection does not silently rewrite the forecast’s age or the decision sequence.

Queue count derives from actual outage/review/approval/activation actions. Do not promise it is always four in another rehearsal branch.

## 14 — End on consequence and evidence

**Action:** Operations → Decision Log; expand a record; return to Operations for the closing frame.

> Now inspect the consequence: five missions delivered, one deliberately deferred, and the station’s modeled essential service retained. The history connects changed assumptions and observed events to the proposals and operator decisions that followed. Conditions changed. The plan changed with them. Missions, resources and human authority remained connected. FIRN: mission-aware energy resilience.

At H48 the selected branch has about **240 kWh / 1,170 L**, with a separate nominal projection of about **765 L before resupply**. These are generated results, not universal guarantees. Do not confuse current inventory with arrival projection.

Optional closing: “The intended hardware pathway is adapter-based integration with station sensor networks and equipment interfaces.” Adapters are planned, not connected.

## Rehearsal discipline

- Start with Reset case in Simulator, then Operations. Reset affects only this browser-local recording key.
- Do not reorder scene 5 activation and scene 7 future edits; V2/V3/V4 then remain consistent.
- Pending proposals intentionally pause playback. Review is allowed for a no-go; approval is not.
- Moderate derating may require no replacement. Full outage is an available no-go branch, not the selected recording event.
- Simulator has power, weather, resource and mission views; supporting asset/load/freshness details are available without narrating every item.
- Sources retain the compact prototype/hardware boundary. Login/settings and the backend-connected workspace are untouched.
- Values are generated by the shared model, exported with `node --experimental-strip-types scripts/export-recording-case.mjs --output docs/verification/recording-case/data.json`.
