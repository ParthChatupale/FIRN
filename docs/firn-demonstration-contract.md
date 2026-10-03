# FIRN Demonstration Contract

**Purpose:** This is the product-level source of truth for what FIRN must prove in a presentation, product walkthrough, and future UI decisions. It complements the implementation-focused [domain specification](firn-domain-spec.md) and the delivery-focused [roadmap](../roadmap.md). If a proposed screen, feature, or script does not help prove one of the outcomes below, it is not a priority for the demonstration.

## 1. The FIRN proposition

FIRN helps a remote polar station protect people and critical operations while delivering as much mission value as possible under uncertain weather, finite energy and fuel, constrained assets, and uncertain resupply.

The important distinction is **joint operational planning**. FIRN does not treat the mission schedule, energy dispatch, fuel runway, weather risk, and asset availability as separate dashboards. It evaluates them as one operating problem, presents the consequence of a decision, and keeps the operator in control of activation.

## 2. What a viewer must understand

By the end of a short walkthrough, a technically informed viewer should be able to say all of the following:

1. **FIRN sees the whole operating picture.** It brings mission demand, critical station loads, renewable availability, generators, battery reserve, fuel, weather, assets, and resupply into one coherent time-based view.
2. **FIRN plans the trade-off, not just the forecast.** A mission is scheduled only when its timing, power requirement, weather window, shared resources, battery policy, generator limits, fuel position, and station load can coexist.
3. **FIRN protects non-negotiables.** Critical service, protected battery reserve, generator availability, fuel bounds, asset exclusivity, and mission weather rules are constraints—not values that can be silently traded away for a better-looking score.
4. **FIRN makes resilience visible.** A delayed ship, storm, reduced renewable output, or generator problem changes the plan’s operating margin. The operator can see what changed, when the risk becomes material, and which missions or resources are affected.
5. **FIRN provides an explainable decision.** It shows the recommended plan, the alternatives or changes considered, the binding constraints, expected resource trajectory, and the operational consequence of accepting or declining it.
6. **FIRN preserves human authority.** Recommendations begin as proposals. A person reviews, edits, approves, and activates them; the prior active plan remains in force until that explicit action occurs.
7. **FIRN adapts without losing traceability.** Monitoring detects meaningful departure from the active plan, creates a linked revision when warranted, and retains the decision history rather than overwriting it.

These are FIRN’s core differentiators. A generic dashboard, isolated forecast chart, or opaque "AI recommendation" is not enough to demonstrate them.

## 3. Demonstration requirements

The final story must make the following moments visible. Each has a required proof, not merely a feature name.

| Moment | What the viewer must see | Evidence required before it is used in the final presentation |
|---|---|---|
| **Operating picture** | Current operational status, active plan, time to resupply, battery and fuel margin, mission status, and the one next decision requiring attention. | One selected run and plan load consistently across the workspace; key values share the same simulated time axis. |
| **Joint plan** | A mission-and-energy plan with mission timing, generator/battery/renewable dispatch, fuel trajectory, and resource constraints. | A persisted feasible optimizer result, plus an independent simulator replay and clear model assumptions. |
| **Safety boundary** | Critical service and reserve policy remain explicit. A constrained case is represented as a safety shortfall or contingency, never hidden as a normal plan. | Targeted scenario tests establish the stated safety behavior. The UI has a deliberate constrained-outcome state rather than a generic optimizer error. |
| **Resupply-aware resilience** | Changing the expected delivery window visibly alters runway, reserve margin, and the recommended operating posture. | A paired baseline/disruption case with the same starting state and seed, documented before/after measures. |
| **Uncertainty-aware choice** | At least two credible future operating conditions produce an understandable difference in risk or plan robustness. | Reproducible nominal/adverse trajectories and a transparent uncertainty assumption; no claim of calibrated probability until real-data evaluation exists. |
| **Explanation and comparison** | Why a proposed revision differs from the active plan, what is protected, and what mission value or fuel trade-off is made. | Persisted plan version, structured explanation, comparison, and approval history. |
| **Adaptive response** | A meaningful change is detected during execution; FIRN retains the active plan, proposes a revision, and lets the operator decide. | An end-to-end monitoring/replanning test and a stable walkthrough case. |
| **Trust and reproducibility** | The scenario, model version, inputs, plan version, and resulting telemetry can be retrieved and replayed. | Persisted PostgreSQL records and a written run procedure. |

## 4. The single operating story

The primary walkthrough should be one connected operational story—not a tour through disconnected product pages.

1. **Start in control:** show a station with an approved operating plan, healthy safety margins, a mission queue, and a known resupply horizon.
2. **Expose the plan:** show how FIRN chose a feasible mission timing and energy/fuel dispatch while preserving critical-load and reserve constraints.
3. **Introduce one disruption:** use a scenario whose consequence is clear and whose planner result is verified—such as a resupply delay, generator loss, or deteriorating renewable conditions.
4. **Show the decision:** surface the deviation, its effect on runway/reserve/mission delivery, the recommended revision or safety contingency, and the reason for it.
5. **Keep authority visible:** compare the active and proposed plans; allow an operator to approve and activate deliberately.
6. **Close the loop:** advance execution and show the updated state and preserved decision history.

The appropriate result of a severe disruption may be **a controlled no-go or mission deferral**, not a magically feasible plan. That is a strength when it is explained as a safety-protecting result.

## 5. Product and visual principles

The product should look like an operational decision system, not a collection of explanatory cards.

- The first screen answers four questions immediately: **Are we safe? What is the active operating plan? What changed? What decision is needed now?**
- Keep current state, active-plan margin, decision queue, and the most important deviation visible together on a normal presentation-size display.
- Use a common simulated clock and selected plan/run throughout the workspace. Changing context must be obvious and deliberate.
- Prioritize time-series evidence, margin-to-limit, schedule, and comparison over generic feature descriptions, raw identifiers, or decorative status cards.
- Make risk states and unavailable data unambiguous. Do not turn infeasibility into a red technical exception with no operational interpretation.
- Keep provenance and prototype boundaries available in a concise methodology/about area and presentation disclaimer; do not let raw implementation labels dominate the operator experience.
- Do not imply live telemetry, physical control, a real station digital twin, calibrated weather probabilities, or autonomous action.

## 6. Claim discipline

| We can demonstrate now or after verification | We must not claim yet |
|---|---|
| Repeatable station scenarios with persisted inputs, telemetry, and decision records | Connection to a real Antarctic station or industrial control equipment |
| Joint mission–energy optimization under the documented model | Validated superiority over alternatives before Phase 8 evaluation |
| Explicit constraints, plan lifecycle, and operator approval | Autonomous control or automatic plan activation |
| Synthetic nominal/adverse future trajectories and deterministic stress planning | Calibrated probabilistic forecasting or a synchronized physical digital twin |
| Monitoring playback and checkpoint-based proposed revisions | Real-time observed-state assimilation or live online replanning |

## 7. Completion checklist for the final presentation

- [ ] A chosen baseline run produces a feasible, persisted, reviewable, and active plan.
- [ ] A chosen disruption produces a verified operational outcome: a safe revision **or** a clearly explained safety contingency.
- [ ] The primary view communicates safety, active plan, change, and next decision without a page-long introduction.
- [ ] Plan comparison makes the mission, fuel, battery, risk, and constraint trade-offs understandable.
- [ ] The approval transition is explicit and the previous active plan is preserved until activation.
- [ ] Monitoring and replanning complete the same story with one consistent run/plan context.
- [ ] The selected walkthrough cases have automated regression coverage and an operator rehearsal script.
- [ ] Phase 8 evidence states where joint FIRN helps, where it does not, runtime/infeasibility rates, and assumptions.
- [ ] The presentation contains one clear prototype/data disclaimer and makes no unsupported real-world claim.

## 8. Relationship to the roadmap

- **Phases 1–6** provide the simulator, forecasts/scenarios, optimization, controlled plan lifecycle, and monitoring/replanning capabilities behind this contract.
- **Phase 7** connects those capabilities to a working product workflow. Its next design pass must be judged against Sections 3–5 of this document, not by how many screens it contains.
- **Phase 8** establishes the measured evidence needed to select the final baseline and disruption cases and to support any claim about comparative value.
- **Phase 9** packages the single operating story, the UI, the runbook, and the evidence into a credible final presentation.

## 9. Decision rule for future work

Before adding a feature, ask: **does it improve the operator’s ability to understand, safely decide, approve, or adapt within the joint mission–energy problem?**

If not, defer it unless it is required for evidence, reliability, or presentation readiness.
