# FIRN Product UI Architecture

**Status:** Proposed design direction before the Phase 7 visual rebuild  
**Decision:** Re-architect the user-facing workspace around operator jobs. Retain the working FastAPI/PostgreSQL workflow and domain objects; do not rebuild the simulator, planner, or database for a visual redesign.

**Implementation boundary:** Build the replacement as a separate application in `frontend/`. Preserve the current root `src/` frontend and its existing commands. Both applications use the same backend API and PostgreSQL database. Do not replace the existing frontend until the new interface is reviewed and verified against the demonstration contract.

**Current implementation status:** Initial redesign source has been preserved in `frontend/src/`, but the standalone application and UI Phase 1 are not complete. Folder creation and preserved components are not evidence that the design acceptance criteria below have passed.

This document turns the [FIRN Demonstration Contract](firn-demonstration-contract.md) into a deliberate product structure. It replaces the current module-led navigation approach, where Forecast, Energy & Assets, Simulator, and Decision Log appear as peers even though they are inputs or evidence for a larger operating decision.

## 1. The organizing principle

FIRN is not a collection of analytics pages. It is an operating decision system.

Every screen must help an operator answer one of these five questions:

| Operator job | The question |
|---|---|
| **Orient** | Is the station safe, what is active, and what needs attention? |
| **Plan** | What operating plan best protects the station while delivering mission value? |
| **Monitor** | Is execution still following the active plan, and does a change require action? |
| **Explore** | What happens if conditions, resources, or resupply change? |
| **Account** | What decision was made, why, and what changed afterwards? |

The core FIRN differentiators—joint planning, safety constraints, resilience, explanation, operator authority, and adaptive replanning—must appear inside these jobs. They should **not** become individual navigation entries or a row of generic feature cards.

## 2. Proposed primary navigation

The current sidebar exposes seven technical modules. The target production navigation has five operator workspaces:

| Navigation item | Purpose | Replaces or absorbs |
|---|---|---|
| **Operations** | The default command center: operating status, active plan, runway, forecast horizon, and attention queue. | Current Overview; summary portions of Energy & Assets and Forecast. |
| **Plan** | Build, inspect, compare, revise, approve, and activate a mission-and-energy operating plan. | Mission Planner. |
| **Monitor** | Compare execution with the active plan, inspect deviations and alerts, and respond with a proposed revision. | Monitoring. |
| **Scenario Lab** | Prepare and run controlled operating cases, resume saved cases, and inspect input assumptions. This is a demonstration/analysis tool, not the normal operating console. | Scenario Simulator. |
| **Decision Record** | Searchable, time-ordered plan versions, approvals, events, reasons, and outcomes. | Decision Log. |

### What is deliberately not a primary destination

- **Forecast** becomes the look-ahead layer in Operations and Plan. It is useful only in the context of a decision.
- **Energy & Assets** becomes an operations detail drawer/tab and planning constraint view. A generator or battery is an operating resource, not a separate product.
- **Backend health, raw UUIDs, database status, seeds, simulator versions, and source-run IDs** leave the persistent operator UI. They belong in a compact case-details panel, methodology view, or developer diagnostics.
- **Synthetic/prototype provenance** remains visible in the presentation and methodology/about surface, but it should not consume the first viewport of every operating screen.

This answers the “why only five?” question: five is the number of recurring human tasks, not the number of system capabilities. The capability is demonstrated where it changes the decision.

## 3. Persistent application frame

All five workspaces share a disciplined operating frame.

### Persistent top bar

- Station / operating case name.
- Current modeled time and data freshness/state.
- Active-plan state: no plan, proposed, active, superseded, or attention required.
- Alert counts by severity and an operator notification entry point.
- Operator identity and a concise case-details/provenance control.

### Persistent safety strip

Shown when it is useful, never as a developer banner:

- overall operating posture: **Stable**, **Watch**, **Constrained**, or **Action required**;
- time to resupply, fuel margin, protected battery margin, and critical-service state;
- one concise explanation of the most important risk.

The status is a conclusion backed by visible evidence, not a decorative green dot. Warning and critical states must be unmistakable and include the required next action.

### Interaction rules

- A selected case/run and plan are global context. Changing either has a clear confirmation and updates the whole workspace together.
- Approval and activation are distinct, safeguarded actions. The UI always identifies what is currently active.
- Details open progressively from a summary rather than forcing the operator through long page stacks.
- The presentation desktop layout must keep the operating posture, key margins, alert queue, and plan state visible together. Long event history and tables scroll inside their own regions.

## 4. Workspace blueprints

## Operations — the home screen

**User question:** “What is happening now, and what do I need to decide?”

This is the default landing screen and the key presentation frame. It must look useful before the viewer clicks anything.

### Above the fold

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Station / time / operating posture / active plan / alert count           │
├───────────────────────────────┬──────────────────────────────────────────┤
│ OPERATING CONDITION           │ NEXT DECISION                            │
│ Stable / Watch / Action       │ One actionable recommendation or “none”  │
│ critical service + plain text │ owner, due horizon, consequence           │
├───────────────┬───────────────┼──────────────────────────────────────────┤
│ Fuel runway   │ Battery margin│ 48–72 h operating horizon                 │
│ Resupply ETA  │ Mission health│ demand / renewable / reserve annotations  │
├───────────────────────────────┼──────────────────────────────────────────┤
│ Active operating plan         │ Attention queue                            │
│ compact mission schedule      │ deviations, alerts, recommended action     │
└───────────────────────────────┴──────────────────────────────────────────┘
```

### Required content

- A plain-language operating condition, tied to critical service and margin—not an abstract health score.
- Four concise decision metrics: fuel runway, battery margin above protected reserve, resupply horizon, and mission delivery status.
- One annotated time-series view of the near-term energy picture. It should answer a question such as “why does reserve become tight before resupply?” rather than plotting every available variable.
- A compact active-plan schedule showing the missions that matter next.
- An attention queue with an explicit action such as **Review revision**, **Inspect constraint**, or **No action required**.

### Do not put here

- Generic product marketing cards.
- A long explanatory introduction.
- Raw run IDs, seed values, database health, or a “no proposal selected” card stretched across a large blank region.
- All historical charts. Operations is the situation view, not a data warehouse.

## Plan — the decision workspace

**User question:** “What should we do, and what do we give up or protect by doing it?”

### Required layout

- **Decision header:** operating posture, source case, plan state, the decision to make, and primary action.
- **Mission schedule:** a readable horizontal schedule/Gantt showing planned, deferred, and constrained work.
- **Resource horizon:** aligned battery, fuel, renewable/generator, and resupply evidence on the same time axis as the schedule.
- **Plan comparison:** active versus proposed plan, emphasizing changed missions, fuel/reserve impact, and risk—not every unchanged field.
- **Why this plan:** binding constraints, mission choices, assumptions, and interpretation limits in an inspectable side panel.
- **Lifecycle controls:** edit, review, approve, activate. Activation explicitly confirms the replacement of the active plan.

### Required constrained outcome

When the conditions cannot safely support a plan, Plan must present a first-class **Safety contingency** outcome: what cannot be served or completed, when the shortfall occurs, what constraints caused it, and the available mitigations. A generic red “optimizer failed” banner is not an acceptable product state.

## Monitor — execution and adaptive response

**User question:** “Are we still on plan; if not, what should change?”

### Required content

- Current observed state versus active-plan expectation, with the current time clearly marked.
- A prioritized alert/deviation queue; each item states severity, when it began, impact, and suggested next step.
- A focused execution timeline with actual-versus-plan comparison for the variables relevant to the current deviation.
- A current mission-progress and asset-status view.
- A proposed revision card when a replan is warranted; it links to Plan for full comparison and approval without losing context.
- Simulation clock controls are compact and clearly labelled as playback/test controls, not disguised as live operational controls.

## Scenario Lab — controlled exploration

**User question:** “What case do I want to evaluate?”

This is intentionally separated from Operations so operators and presentation viewers do not confuse a what-if test with the active operating state.

### Required content

- A small library of named, curated cases for the presentation: baseline, resupply pressure, asset loss, and weather/renewable pressure.
- Plain-language case assumptions and expected question each case answers.
- Advanced controls for days, seed, and input settings—collapsed by default.
- Saved cases and reproducibility metadata available on demand.
- A deliberate **Open in Operations** action after a case has been run and selected.

## Decision Record — accountability and evidence

**User question:** “What was decided, why, and what happened next?”

### Required content

- A chronological decision timeline, filterable by plan, event type, severity, and status.
- Plan versions and approval/rejection/modification history.
- Links from a decision to its triggering observation, explanation, comparison, and resulting outcome.
- Searchable records; raw technical identifiers appear only as copyable secondary metadata.

## 5. Visual direction

FIRN should feel like a calm, high-consequence engineering workstation—not a cyberpunk “AI” mock-up and not a generic SaaS dashboard.

- Use a restrained dark-neutral or light-neutral foundation with a single ice/teal accent for interactive focus; reserve amber and red exclusively for caution and critical conditions.
- Create hierarchy with type scale, whitespace, alignment, and data grouping—not nested rounded rectangles everywhere.
- Use real operational graphics: annotated timelines, schedules, margins-to-limit, state transitions, and compact event queues. Avoid decorative radial gauges, meaningless percentages, and duplicated KPI tiles.
- Keep labels human and specific: “Fuel until resupply”, “Battery above protected reserve”, “Revision awaiting review”; avoid vague labels such as “system operational” without evidence.
- Define one icon library, one severity vocabulary, one set of status chips, and fixed locations for recurring fields.
- Make every chart answer a stated question and show the comparison that matters. Use color as a redundant signal, not the only signal.

This direction follows operator-display principles: keep task-relevant information together, preserve a dedicated area for time/system messages/alerts, make threshold violations and data staleness visible, and provide rationale for recommendations. [NASA Display Standard](https://www.nasa.gov/reference/appendix-f-vol-2/)  
It also follows dashboard discipline: the most important insight is prominent, and each visualization makes one relevant comparison rather than exposing the whole dataset. [ONS dashboard guidance](https://service-manual.ons.gov.uk/data-visualisation/guidance/dashboards) · [ONS visualization principles](https://service-manual.ons.gov.uk/data-visualisation/guidance/principles)

## 6. Motion, playback, and visual evidence

### Motion has to mean something

FIRN should not simulate “liveness” with looping charts, counters, glowing dots, or values that change without a corresponding state transition. That would weaken trust.

The valid source of movement is the existing persisted simulation/monitoring playback:

1. A prepared operating case supplies an approved plan and an initial operating state.
2. The operator starts or resumes the monitoring playback.
3. The simulated clock advances by a deliberate step—normally one hour for investigation or six/twelve hours for the presentation.
4. Only values from the matching persisted telemetry record update: weather, renewable output, demand, battery, fuel, mission progress, asset availability, alerts, and plan comparison.
5. At a material event, the interface marks the deviation, explains its consequence, and offers a plan revision or safety contingency. The operator then reviews and decides.

Chart transitions may smoothly move from one actual data point to the next so the change is easy to follow, but they must not loop or run independently. They should honor reduced-motion preferences. The visible timestamp and playback state must make it clear that this is an evolving modeled operating case, not claimed live telemetry.

### Presentation interaction arc

The most convincing video is a guided change in one operating case:

| Beat | What moves | What the viewer learns |
|---|---|---|
| **Baseline** | No playback yet; the active plan and margins are stable. | FIRN has one coherent operating picture and a feasible joint plan. |
| **Look ahead** | Scrub or advance the shared time cursor across the next operating horizon. | Energy, fuel, resupply, mission timing, and weather are considered on one time axis. |
| **Disruption** | Advance to a verified event or apply a prepared scenario transition. | A real change affects the plan’s margin, rather than an animation merely changing colors. |
| **Response** | The alert/deviation and proposed revision appear from persisted results. | FIRN detects the consequence and explains the trade-off or safety boundary. |
| **Decision** | The operator approves/activates the revision; plan state changes. | Human authority is explicit and recorded. |
| **Execution** | Playback advances under the selected active plan. | The decision loop closes with traceable outcomes. |

Phase 8 must select the exact baseline/disruption pair for this sequence. If the chosen disruption is genuinely infeasible, the video should show the controlled safety-contingency outcome, not manufacture a successful replan.

### Visualization grammar

FIRN only needs a small set of strong, repeated visual forms. Every view must share the same selected case, plan, and simulated time cursor.

| Visual | Question it answers | Where it belongs | Data and encoding |
|---|---|---|---|
| **Operating-horizon balance** | “Will available supply meet demand during the next 48–72 hours?” | Operations; Plan detail. | Time on x-axis; demand as a clear line; renewable, generator, and battery contribution as restrained stacked supply areas; critical shortfall as an unmistakable exception marker. Units: kW. |
| **Reserve trajectories** | “How close are we to the protected battery reserve or fuel constraint before resupply?” | Operations; Plan comparison. | Two aligned small multiples, not a dual-axis plot: battery energy with a protected-reserve line (kWh), and fuel inventory with resupply event (L). |
| **Mission schedule** | “Which work is planned, deferred, weather-limited, or changed?” | Operations compact view; Plan full view. | A horizontal Gantt on the same time axis; lanes by mission/resource, labeled state and priority; weather or asset restrictions as annotations. |
| **Plan difference view** | “What changes if we adopt this proposal?” | Plan. | Aligned before/after mission lanes plus a concise delta list for fuel at resupply, minimum battery margin, mission value/completion, and risk state. No opaque aggregate score. |
| **Actual-versus-plan deviation** | “Has execution diverged, when, and by how much?” | Monitor. | A focused line comparison for the variable relevant to the selected alert, with an event marker and stated threshold. Avoid putting five unrelated variables on one plot. |
| **Decision/event timeline** | “What was observed, proposed, approved, and activated?” | Decision Record; Monitor. | Time-ordered markers with severity and plan-version links; expandable detail rather than a dense table by default. |
| **Scenario comparison** | “Which tested condition creates the greater operational pressure?” | Scenario Lab; Phase 8 evidence. | Paired small multiples or a concise comparison table using the same seed/initial state; show measured deltas and infeasibility explicitly. |

### Metrics worth putting on the primary screen

Use only four headline measures, each paired with its decision meaning:

1. **Fuel until resupply** — inventory/runway and whether the delivery horizon is protected.
2. **Battery margin** — energy above the protected reserve, not raw state of charge alone.
3. **Critical service** — served/at-risk/shortfall, never hidden inside an overall score.
4. **Mission delivery** — completed/planned/deferred mission value or count, with the next affected mission visible.

Supporting values—renewable contribution, generator runtime, wind, temperature, asset state, solver/runtime metadata, seeds, and raw provenance—appear only when they explain a current decision or are opened for evidence.

### Visual anti-patterns to avoid

- No radial gauges, decorative progress rings, live-looking spark lines, or count-up animation without an operational question.
- No wall of equally weighted KPI tiles; metrics must have a relationship to a risk, threshold, plan, or action.
- No dual y-axis chart for battery and fuel, and no chart with every available telemetry field merely because the data exists.
- No generic empty states that fill a large panel. A setup state should direct the user to a curated case or explain the missing prerequisite compactly.
- No generic “AI” language, unexplained health scores, or green state without visible supporting margin.

## 7. Design and delivery sequence

### Step 1 — Freeze the operator story and evidence cases

Use the demonstration contract to select one baseline case and one verified disruption case. Phase 8’s targeted evaluation begins here: it identifies a credible case where FIRN has a demonstrable outcome and identifies cases that should be shown as a safety contingency instead of a successful recommendation.

### Step 2 — Build a content inventory

Map every current API object and visual to one of the five workspaces. Remove duplicate and invented display values. Decide which fields are primary, expandable, record-only, or developer-only.

### Step 3 — Design the information architecture before pixels

Create desktop wireframes for the five blueprints above. Review them against four questions: can the viewer see safety, active plan, change, and next decision without scrolling? Does each interaction preserve context? Is the required action clear? Does any panel exist only to explain the product rather than run it?

### Step 4 — Establish a small design system

Implement the shell, type scale, spacing, data density, severity states, chart grammar, empty/loading/constrained states, keyboard focus, and responsive rules once. Do not style each route independently.

### Step 5 — Build in story order

1. Operations and the persistent frame.
2. Plan and the active-versus-proposed comparison.
3. Monitor and the adaptive-response path.
4. Scenario Lab and Decision Record.
5. Desktop visual QA, accessibility pass, and the rehearsed presentation flow.

### Step 6 — Validate against Phase 8 and the demonstration checklist

Use stress-test results to verify that every chart and recommendation used in the story is supported by a stable, repeatable case. Phase 8 does not need to wait for the entire visual build, but the final UI must not be frozen until its claims and selected cases are measured.

## 8. Design acceptance criteria

- [ ] Navigation has five operator workspaces, with no technical module appearing as a primary destination unless it represents a distinct operator job.
- [ ] Operations answers safety, active plan, current change, and next decision in one desktop view.
- [ ] Forecast, assets, constraints, and explanations appear in the context of an operating decision.
- [ ] No persistent raw run/plan identifiers, seed values, backend health, or engineering disclaimers interrupt the primary operator workflow.
- [ ] Feasible, constrained, loading, unavailable, and error states are intentionally designed and distinguishable.
- [ ] Approval and activation cannot be confused; the active plan is always evident.
- [ ] Every visualization has a decision question, an understandable time reference, and an accessible text/table alternative where needed.
- [ ] Movement is driven only by explicit simulation playback or an operator action; the shared time cursor and playback state are always visible.
- [ ] The final walkthrough passes the demonstration-contract checklist and uses verified Phase 8 cases.
