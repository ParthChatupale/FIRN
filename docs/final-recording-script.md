# FIRN — final recording script

Target: approximately 5–6 minutes with edited execution intervals. Read only the quoted narration; the screen directions are filming cues.

Before filming: save the current rehearsal snapshot, reset the recording case off-camera, and start at H0 with Original V1 active. Use full screen; let browser overlays disappear. Keep preparation waits visible, but cut long execution intervals or use the event advances. Do not describe edited jumps as real-time operation.

Opening caption: **Controlled station simulation · modeled station data and external connectivity · no physical equipment controlled.**

## 1 — The hook

**Show:** Operations. Start with the dashboard, briefly select Observed, then return to Plan outlook. Keep the opening unhurried; do not read every number.

> Keeping the lights on is not the same as completing the mission.
>
> At a polar station, teams need usable weather windows. Scientific work needs shared equipment and power. And fuel has to last until resupply.
>
> When conditions change, what can we still deliver—and what must we defer?
>
> That's the decision FIRN brings together.
>
> We've paused a controlled station simulation here. These charts show previous operation, the current state, and the outlook ahead.

## 2 — The commitments already in force

**Show:** Mission Planner. Opening baseline comparison cards, Original V1 Active badge, active mission timeline, and shared-resource conflict notice. Do not Generate yet.

> First, the commitments already in force. Original V1 is active; the baseline report compares original timing, energy-first planning, and joint mission–energy coordination.
>
> These are evaluated alternatives, not three activated plans. The original schedule has two instrument-team overlaps: the same people and equipment cannot serve competing commitments at once.

## 3 — The planning basis

**Show:** Scenario Simulator. Current-state strip, baseline weather, and zero additional resupply delay. Keep the generator disturbance unselected.

> Each view shares the same station case. Future projections use the current resources and configured weather and logistics assumptions. Historical operation provides context; this is not a history-trained weather predictor.
>
> Previewing a scenario does not change current observations or activate a plan.

## 4 — The normal outlook

**Show:** Look ahead before changing assumptions. Renewable outlook, battery exposure, and fuel exposure.

> Here is the normal outlook. Weather affects usable renewable generation and heating demand; both affect battery and fuel.
>
> We inspect nominal and adverse assumptions to understand exposure—not to present one future as certain.

## 5 — Change the future, not the past

**Show:** Simulator → Storm + delayed resupply. Show Input preview, the three-day delay, storm onset H24, and revised arrival. Click Apply future assumptions.

> Now resupply slips by three additional days, and a storm front is expected tomorrow.
>
> The arrival estimate moves from January eighteenth to January twenty-first. I preview the changed conditions, then apply them. Current fuel and battery have not suddenly disappeared; the future operating exposure has changed.

## 6 — Make the consequences visible

**Show:** Open the notification bell. Hold on forecast updated, restricted field conditions forecast, and planning response required. Follow to Look ahead.

> The notifications make that change visible. Field access is forecast to tighten, while lower usable generation and increased heating demand put pressure on resources.
>
> Stronger wind is not always more useful power: above the configured cut-out, wind production falls. V1 remains active; a forecast update is not an authorized revision.

## 7 — Generate the joint response

**Show:** Mission Planner → Generate joint proposal. Hold through preparation. Show the refreshed comparison, proposed V2, schedule changes, and dispatch.

> I request a fresh joint proposal. FIRN coordinates mission windows, shared resources, and energy dispatch against the updated assumptions.
>
> This response retains all six missions, removes the instrument-team overlaps, and brings field sampling forward. We compare mission delivery, battery margin, and fuel together—not just one attractive number.

## 8 — Human authority

**Show:** Review proposal → Approve → Activate V2. Return to Operations. Clock remains paused; opening inventories remain unchanged.

> A recommendation is not authorization. I review its limits and consequences, approve it, and explicitly activate V2.
>
> Until that final action, V1 remains in force. Activation changes the operating plan; it does not reset inventories or consume future resources instantly.

## 9 — Observe execution

**Show:** Monitoring. Show a brief running-mission segment and progress. Advance to the H24 weather checkpoint; show completed missions and their notices. Click Observe weather event and show the changed weather and observed/reference plot.

> Now we advance the simulation. Mission progress reflects supplied work, and completion is recorded in the execution history.
>
> At the weather checkpoint, I record the modeled observation. We can compare observed operation with the issued reference. Four missions have completed; their work and earlier readings remain intact.

## 10 — An independent equipment disturbance

**Show:** Scenario Simulator at H26. Show current Generator 01 capacity 80 kW; select 10 kW severe derating and Apply capacity loss. Wait for assessment. Open Monitoring and show the capacity drop and response-required notice.

> Weather is not the only uncertainty. We now introduce an independent equipment disturbance: Generator 01's available capacity falls from eighty to ten kilowatts.
>
> FIRN records the event, then assesses the active plan. Under adverse conditions, the remaining commitments require a response. V2 stays active; no replacement is silently imposed.

## 11 — Adapt the remaining work

**Show:** Connectivity → Model external outage → close the tray. Mission Planner → Generate joint proposal → wait. Show V3 preserving four completed missions, deferring calibration, and retaining sample preservation. Review → Approve → Activate V3.

> We also model an external-link interruption. The local case remains available, while new records queue for acknowledgement.
>
> The revised proposal preserves completed work and retains sample preservation, while explicitly deferring flexible calibration. The reduced capacity has a visible consequence—not a promise that everything can still be done.
>
> I review, approve, and activate V3.

## 12 — Complete and reconnect

**Show:** Resume execution. Show sample preservation running and its completion notice; follow the visible authorized window rather than claiming a fixed retiming. Continue to the H48 automatic stop. Connectivity → Restore external uplink → Acknowledge queued records → Receive forecast separately.

> Execution continues under the authorized revision, and sample preservation completes.
>
> When the modeled external link returns, reconnection, record acknowledgement, and forecast receipt remain separate actions. Restoring a connection does not erase the decision history or silently replace the planning assumptions.

## 13 — Close on the outcome

**Show:** Operations at H48: five completed, zero remaining, one deferred. Open Decision Log and expand a relevant proposal or activation record; return to the dashboard for the final frame.

> Five missions completed. One deliberately deferred. Essential services retained in this simulated case.
>
> The decision history connects changed assumptions and observed events to the proposals and operator choices that followed.
>
> Conditions changed. The plan changed with them. The trade-offs stayed visible, and authority stayed with the operator.
>
> FIRN: mission-aware energy resilience.

## Recording guardrails — not spoken

- Plan revisions: Original V1 → weather/logistics response V2 → capacity-loss response V3. The three comparison cards are planning approaches, not these revision numbers.
- Scenes 1–8 are paused at H0. Later pauses are simulation/filming checkpoints, not claims that a real station stops while someone reviews a plan.
- Baseline comparison is already calculated. Changed conditions retain the previous timestamped report until a new generation finishes. Only fresh results should be narrated as the current comparison.
- Acknowledging a notification means seen; it does not authorize a proposal or resolve the underlying condition.
- Use the visible sample-preservation window. Do not assert that it moved if the generated proposal retains its timing. Calibration is the demonstrated deferral.
- The connectivity segment is a modeled workflow, not a real network-disconnection test. Show Model external outage before generating V3 if using this narration; do not claim offline generation in a take where the link stayed connected.
- Read actual final resources from the captured case if mentioning them. Fuel now and projected fuel before resupply are different quantities; resupply has not arrived by H48.
- Keep long clock playback out of the final edit. At the default rate, full H0–H48 playback alone takes eight real minutes.
- Team introductions, credits, and extra hardware-roadmap discussion are outside the 5–6 minute target.
