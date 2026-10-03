# FIRN recording script — operator workflow

Status: revised narration/actions match the implemented corrections. Browser rehearsal and final user visual acceptance remain pending. This thirteen-scene order supersedes the earlier baseline-joint V2 → weather V3 → adaptive V4 sequence.

Before the walkthrough, give a brief disclosure outside the operating panels:

> This walkthrough uses a controlled station simulation to demonstrate FIRN’s decision-support workflow. Station values and external connectivity are modeled; no physical equipment is controlled.

Team introduction is separate. One case, one operator, one continuous clock: **15 January 2026, 06:00 UTC** at H0; **17 January, 06:00 UTC** at H48. H means elapsed station hours. Start with Simulator → Reset case → confirm, then Operations.

This is the functional rehearsal sequence; final video wording can be polished separately. Scenes 1–8 remain paused at H0. After activation, click the header clock to play/pause minute-level execution. Shift-click it or use Alt+R to open rehearsal controls (opening them pauses execution); close before recording. Event boundaries, not explanation/shooting duration, stop playback. See [checkpoint map](event-playback-plan.md).

The panel automatically saves paused storyboard snapshots and supports named manual snapshots. Restore replaces the complete browser-local case and always pauses; it does not change backend data or the fixed case date. Save your current scene before restoring a different one. Use a saved first-mission snapshot or manual advance to H7 if you want a short running-mission shot before continuing; do not claim skipped intervals happened in real time.

## 1 — Hook: enough energy is not enough

**Action:** Operations at H0 / active original plan V1. Briefly select **Observed** to show the preceding 48 hours, then return to **Plan outlook**. Indicate current power, reserve, fuel, resupply and mission windows without reading every metric.

> We have paused an ongoing station simulation at this operating point. The observed view shows earlier station operation; the outlook shows what lies ahead under the current assumptions. We will resume execution after reviewing the planning response.

> A polar station can have enough energy to keep its lights on—and still lose its mission. A field team needs a usable weather window. Laboratory work needs equipment and power. Essential services cannot simply be switched off, and fuel has to last until resupply. These are not separate decisions. FIRN brings them into one operating picture.

Opening resources: **312 kWh / 1,650 L**. The 48h modeled historical intervals close at those inventories. Do not describe them as live telemetry or training data for a learned forecast. Operations is the dashboard and attention queue, not a second approval screen.

## 2 — Introduce planning before requesting a response

**Action:** Mission Planner. Show active V1 schedule and upcoming shared-resource conflict attention. Do not generate yet.

> Energy is only part of this commitment. The original schedule also shares people and equipment. Here I inspect what is already in force, where commitments overlap, and request a coordinated mission-and-energy response when the operating basis changes.

Two upcoming instrument-team overlaps belong to V1. Joint comparison results must not be visible before generation. Acknowledgement means seen, not resolved.

## 3 — Establish the station case

**Action:** Scenario Simulator. Show current-state slab and weather or resource visualization. Observed history includes the preceding station operation and execution up to the paused point; Applied outlook shows future assumptions. Verify **+0 additional delay / baseline weather**. Leave the draft unapplied.

> These views share the same station case: weather, generation, demand, storage and mission commitments on one clock. We can preview a future condition without changing current readings or silently replacing the active plan.

Original delivery: **18 January, 06:00 UTC**. V1 was issued on that baseline. Drafting is not applying.

## 4 — Normal forecast first

**Action:** Look ahead before disturbances. Show normal renewable availability and nominal/adverse assumptions.

> Before changing anything, here is the outlook behind the current commitments. Weather affects usable generation and heating demand, and those flows affect battery and fuel. We inspect an expected operating case alongside an explicit adverse assumption rather than treating one future as certain.

The envelope is assumption-based, not a learned confidence interval. Forecast enters the story here; joint planning responds to the changed outlook later.

## 5 — Change the future, not the past

**Action:** Simulator → **Storm + delayed resupply** preset. Inspect Input preview and physical before/after values → Apply future assumptions.

> Now the logistics estimate slips by three additional days, and a storm front is expected tomorrow. I preview the changed arrival and physical conditions, then apply them to the same case. The station has not suddenly lost fuel or battery energy; its future exposure has changed.

Delivery moves **18 → 21 January**, not “three days until arrival.” Named storm onset is H24. Show wind, temperature, visibility and renewable availability rather than narrating a percentage of bad weather. A 30% downside renewable reduction retains 70% before other adverse changes.

Input receipt is immediate. Forecast preparation takes a configured minimum of about **one second**; readiness follows completion. Current inventories remain unchanged.

## 6 — Forecast to consequence

**Action:** Follow forecast-ready notification to Look ahead; briefly return to Operations for resource exposure.

> The updated outlook narrows the field opportunity and changes the resources needed before resupply. Stronger wind is not always more usable generation: above the configured cut-out, wind production falls. Cloud cover reduces solar output, while colder conditions increase modeled heating demand. The longer wait compounds that exposure.

Technically: versioned environmental/logistics assumptions drive load and inventory recurrence. V1 is still active, not already adapted. Predicted restrictions are not observations; shared-team conflicts belong to planning, not the weather alert list.

## 7 — Request the joint response

**Action:** Mission Planner → Generate proposal. Hold on preparation; wait for ready notice. Then inspect original / energy-first / joint comparison, schedule and dispatch.

> Now there is a reason to plan again. I request a joint response to the changed outlook, coordinating mission windows and shared resources with energy dispatch and protected reserves. Keeping original timing or deferring flexible work are alternatives. FIRN makes that trade-off visible rather than reducing the decision to one fuel number.

Minimum proposal presentation interval: **2.5 seconds**, not measured backend solver time. Results publish after completion. Joint removes two overlaps and moves field sampling **H8 → H7**. Do not claim every metric improves: the trade-off includes mission delivery and battery margin.

## 8 — Human authority

**Action:** Inspect active/proposed consumption, reserves, arrival fuel and mission changes. **Review → Approve → Activate V2**, in Mission Planner only. Return to Operations.

> A recommendation is not authorization. I inspect its limits and consequences, approve it, and explicitly put the revision into operation. Until activation, the previous plan remains in force.

V2 activates; conflict attention resolves, with history retained. Opening resources remain **312 kWh / 1,650 L**. Projection changes are not consumption. Nominal fuel before delivery is about **805 L**, versus **856 L** for V1 on revised inputs; this is distinct from matched-horizon fuel consumption.

## 9 — Expectation becomes observation

**Action:** Resume with the header clock, or use To weather H24 for a quick functional check. Playback stops at the weather checkpoint. Click Observe weather event; it remains paused afterward. Show observed-versus-issued-plan evidence, completed notifications/history and mission activity.

> Now we advance to the forecast event. These are observations in the station case, not just future assumptions. Weather, usable generation, demand and resources evolve together. Completed work and earlier readings remain intact, and the issued reference lets us inspect what actually changed.

H24: about **340 kWh / 1,526 L**. Apply weather once; the outlook does not multiply its effect again. An expected event arriving is not itself a forecast failure.

## 10 — Independent equipment disturbance

**Action:** Resume or advance to H26 (automatic asset stop) → severe generator derating. Hold on observed-event notice, assessment preparation, then planning-response-required notice. Clock remains paused; inspect capacity and frozen reference.

> Weather is not the only uncertainty. Generator 1 now loses most of its available capacity. We first see the equipment consequence, then assess whether the remaining generation, battery and commitments can still coexist. An event is not already a ready replacement plan.

Generator 1: **80 → 10 kW available**; Generator 2: **45 kW**. Severe derating is not a total blackout. Assessment minimum presentation interval: **1.2 seconds**. Event-boundary resources: about **340 kWh / 1,498 L**. Monitoring provides evidence and links to Planner; it does not approve revisions.

## 11 — Authorize a remaining-work revision

**Action:** Optionally Connectivity → model link loss → close non-modal tray. Mission Planner → Generate → wait → Review → Approve → Activate V3.

> The remaining-work response preserves completed missions, deliberately defers flexible calibration, and moves sample preservation to a viable window. I retain the final decision. Here we also model an independent external-link interruption: the local workspace remains usable, while decision records wait in its outbox.

Sample preservation starts **H32**. V2 stays active until V3 activation. Pre-event reference survives. Do not claim real network testing, certified safety, authenticated hardware control or remote synchronization.

## 12 — Continue and restore separate external operations

**Action:** Resume after V3 activation; inspect running sample preservation and its completion notice. Playback stops at H48. For a quick functional check, +6h three times and +1h four times also reach H48 through the same minute integration. Connectivity → Restore uplink → Acknowledge records → separately Receive forecast.

> We continue under the authorized response. When the modeled link returns, decision acknowledgements and forecast receipt remain separate operations. Reconnection does not silently refresh a forecast or erase the decision sequence.

This exact branch queues **seven** records by H48: modeled link loss, proposal generation, review, approval, activation, and sample preservation’s start/completion. Immediately after V3 activation there are five. Counts depend on actions. Alert acknowledgement is separate from outbox acknowledgement.

## 13 — Close on consequence and evidence

**Action:** Operations → Decision Log → expand a record → Operations closing frame.

> Five missions delivered, one deliberately deferred, and modeled essential service retained. The history connects changed assumptions and observed events to the proposals and operator decisions that followed. Conditions changed. The plan changed with them. Missions, resources and human authority remained connected. FIRN: mission-aware energy resilience.

H48: about **240 kWh / 1,170 L** now; separate nominal projection about **765 L before delivery**. Generated case results, not universal guarantees. Optional closing: “The intended hardware pathway is adapter-based integration with station sensor networks and equipment interfaces.” Adapters remain planned, not connected.

## Rehearsal gates

- Normal forecast precedes disturbances; generator scene is independent. Plan sequence: **V1 → V2 → V3**.
- Newly scheduled work includes a configurable authorization/mobilization allowance (30 simulated minutes by default); activation rechecks the time/basis. Completed and ongoing work is retained.
- No result before Generate, no success notice during preparation, no authorization outside Planner. Preparation does not advance station time.
- Changed input basis invalidates pending results. Failed/interrupted tasks support retry, not a success claim.
- Pending proposals or required response pause execution. Moderate derating may need no revision; full outage is a no-go branch, not the recording event.
- Sources retain the compact prototype/integration boundary. Login/settings, connected backend and PostgreSQL stay untouched.
- Regenerate with `npm run recording:export`. Logical export replay is not proof of browser timing/layout.
- Complete [manual verification](verification/rehearsal-corrections/review.md) and approve the visual result before filming.
