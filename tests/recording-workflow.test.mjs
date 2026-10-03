import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as w from "../src/lib/recording-workflow.ts";
import * as m from "../src/lib/recording-engine.ts";
import { comparisonMatchesState } from "../src/lib/recording-comparison.ts";
const reduce = w.workflowReducer;
function complete(s) {
  return reduce(s, {
    type: "complete-task",
    token: s.preparation.token,
    elapsedMs: w.PREPARATION_MS[s.preparation.kind],
  });
}
function authorize(s) {
  for (const type of ["review", "approve", "activate"]) s = reduce(s, { type });
  return s;
}
function changed() {
  let s = reduce(w.initializeWorkflow(), { type: "apply-outlook", inputs: m.RECORDING_INPUTS });
  s = complete(s);
  return authorize(complete(reduce(s, { type: "generate" })));
}
function generator(capacity = 10) {
  let s = changed();
  s = reduce(s, { type: "advance", hours: 24 });
  s = reduce(s, { type: "observe-weather" });
  s = reduce(s, { type: "advance", hours: 2 });
  return reduce(s, { type: "generator-event", capacity });
}
test("baseline inputs match active plan and no candidate is published", () => {
  const s = w.initializeWorkflow();
  assert.deepEqual(s.inputs, m.BASE_INPUTS);
  assert.deepEqual(s.inputs, s.activations[0].inputs);
  assert.equal(s.inputs.resupplyDelay, 0);
  assert.equal(s.comparisonReady, false);
  assert.equal(s.proposal, null);
});

test("baseline report evaluates three alternatives without proposing or activating joint planning", () => {
  const s = w.initializeWorkflow();
  const report = s.comparisonReport;
  assert.equal(report.source, "baseline");
  assert.equal(report.hour, 0);
  assert.equal(report.basis, 1);
  assert.equal(comparisonMatchesState(report, s), true);
  assert.deepEqual(
    report.entries.map((entry) => entry.approach),
    ["original", "energy", "joint"],
  );
  for (const entry of report.entries) {
    assert.deepEqual(entry.outlook, m.resourceOutlook(s, entry.kind));
  }
  assert.equal(report.entries[0].outlook.conflicts, 2);
  assert.equal(report.entries[2].outlook.conflicts, 0);
  assert.equal(s.activeKind, "original");
  assert.equal(s.activeVersion, 1);
  assert.equal(s.proposal, null);
  assert.equal(s.preparation, null);
  assert.equal(s.activations.length, 1);
  assert.deepEqual(m.currentStation(s), m.currentStation(m.initialPresentation()));
});

test("new inputs and preparation retain the previous comparison until generation completes", () => {
  let s = w.initializeWorkflow();
  const previous = s.comparisonReport;
  s = reduce(s, { type: "apply-outlook", inputs: m.RECORDING_INPUTS });
  assert.equal(s.comparisonReport, previous);
  assert.equal(comparisonMatchesState(previous, s), false);
  s = complete(s);
  s = reduce(s, { type: "generate" });
  assert.equal(s.comparisonReport, previous);
  assert.equal(s.proposal, null);
  s = complete(s);
  assert.equal(s.comparisonReport.source, "generated");
  assert.equal(s.comparisonReport.basis, 2);
  assert.equal(comparisonMatchesState(s.comparisonReport, s), true);
  assert.equal(s.comparisonReport.entries[2].kind, s.proposal.kind);
  assert.deepEqual(s.comparisonReport.entries[2].outlook, m.resourceOutlook(s, s.proposal.kind));
  assert.notDeepEqual(s.comparisonReport.entries[2].outlook, previous.entries[2].outlook);
});

test("second generation refreshes all three cards using the independent capacity-loss basis", () => {
  let s = complete(generator());
  const previous = s.comparisonReport;
  assert.equal(previous.generatorCapacity, 80);
  s = reduce(s, { type: "generate" });
  assert.equal(s.comparisonReport, previous);
  s = complete(s);
  assert.equal(s.proposal.version, 3);
  assert.equal(s.comparisonReport.hour, 26);
  assert.equal(s.comparisonReport.generatorCapacity, 10);
  assert.equal(s.comparisonReport.entries[2].kind, "adaptive");
  for (const entry of s.comparisonReport.entries) {
    assert.deepEqual(entry.outlook, m.resourceOutlook(s, entry.kind));
  }
});

test("activation, minute playback and reload preserve the timestamped comparison report", () => {
  let s = complete(reduce(complete(generator()), { type: "generate" }));
  const report = s.comparisonReport;
  s = authorize(s);
  s = reduce(s, { type: "advance-minutes", minutes: 168 });
  assert.equal(s.hour, 28);
  assert.equal(s.minute, 48);
  assert.equal(s.comparisonReport, report);
  assert.equal(s.comparisonReady, false);
  assert.equal(comparisonMatchesState(report, s), false);
  const restored = w.restoreWorkflow(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(restored.comparisonReport, report);
  assert.deepEqual(m.currentStation(restored), m.currentStation(s));
  assert.equal(restored.activeVersion, 3);
  assert.deepEqual(restored.activeSchedule, s.activeSchedule);
});

test("old or malformed optional comparison reports never reset an existing rehearsal", () => {
  const s = authorize(complete(reduce(complete(generator()), { type: "generate" })));
  const old = JSON.parse(JSON.stringify(s));
  delete old.comparisonReport;
  for (const raw of [old, { ...old, comparisonReport: { source: "bad" } }]) {
    const restored = w.restoreWorkflow(raw);
    assert.equal(restored.activeVersion, 3);
    assert.equal(restored.hour, 26);
    assert.deepEqual(restored.activeSchedule, s.activeSchedule);
    assert.deepEqual(restored.observations, s.observations);
    assert.deepEqual(m.currentStation(restored), m.currentStation(s));
    assert.deepEqual(restored.records, s.records);
    assert.equal(restored.comparisonReport.source, "assessment");
    assert.equal(restored.comparisonReport.entries.length, 3);
    assert.equal(restored.proposal, null);
  }
});
test("generation holds results and notification until minimum interval and real completion", () => {
  const s = reduce(w.initializeWorkflow(), { type: "generate" });
  assert.equal(s.proposal, null);
  assert.equal(s.comparisonReady, false);
  assert.equal(reduce(s, { type: "generate" }), s);
  assert.equal(reduce(s, { type: "approve" }), s);
  assert.equal(
    reduce(s, { type: "complete-task", token: s.preparation.token, elapsedMs: 2499 }),
    s,
  );
  assert.equal(
    s.attention.some((n) => n.title.includes("ready")),
    false,
  );
  const done = complete(s);
  assert.equal(done.proposal.version, 2);
  assert.equal(done.comparisonReady, true);
  assert.equal(done.hour, 0);
  assert.equal(done.attention.filter((n) => n.title.includes("ready")).length, 1);
  assert.equal(
    reduce(done, { type: "complete-task", token: s.preparation.token, elapsedMs: 2500 }),
    done,
  );
});
test("forecast receipt is immediate but published curves and readiness remain prior until completion", () => {
  const initial = w.initializeWorkflow();
  const s = reduce(initial, { type: "apply-outlook", inputs: m.RECORDING_INPUTS });
  assert.deepEqual(s.observations, initial.observations);
  assert.equal(s.preparation.kind, "forecast");
  assert.equal(s.forecastReadyBasis, 1);
  assert.equal(s.assumptionVersion, 2);
  assert.deepEqual(w.forecastCase(s).inputs, m.BASE_INPUTS);
  assert.equal(reduce(s, { type: "generate" }), s);
  assert.equal(
    s.attention.some((n) => n.title === "Forecast updated"),
    false,
  );
  const done = complete(s);
  assert.deepEqual(w.forecastCase(done).inputs, m.RECORDING_INPUTS);
  assert.ok(done.attention.some((n) => n.title === "Forecast updated"));
});
test("changed inputs invalidate preparing plan and late tokens cannot publish", () => {
  let s = reduce(w.initializeWorkflow(), { type: "generate" });
  const token = s.preparation.token;
  s = reduce(s, { type: "apply-outlook", inputs: m.RECORDING_INPUTS });
  assert.equal(s.preparation.kind, "forecast");
  assert.equal(reduce(s, { type: "complete-task", token, elapsedMs: 2500 }), s);
  assert.equal(s.proposal, null);
});
test("reset cancels pending task and old token cannot collide with new task", () => {
  const s = reduce(w.initializeWorkflow(), { type: "generate" });
  const reset = reduce(s, { type: "reset" });
  const again = reduce(reset, { type: "generate" });
  assert.notEqual(again.preparation.token, s.preparation.token);
  assert.equal(
    reduce(again, { type: "complete-task", token: s.preparation.token, elapsedMs: 2500 }),
    again,
  );
});
test("acknowledging baseline conflict does not resolve it, alter plan or duplicate it", () => {
  let s = w.initializeWorkflow();
  const conflict = s.attention.find((n) => n.condition);
  s = reduce(s, { type: "ack-attention", id: conflict.id });
  assert.equal(s.activeVersion, 1);
  assert.equal(w.attentionItems(s)[0].active, true);
  assert.equal(w.attentionItems(s)[0].acknowledged, true);
  assert.equal(reduce(s, { type: "ack-attention", id: conflict.id }), s);
  const restored = w.restoreWorkflow(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.attention.filter((n) => n.key === conflict.key).length, 1);
});
test("conflict resolves only on activation; history retains acknowledged record", () => {
  let s = complete(reduce(w.initializeWorkflow(), { type: "generate" }));
  const id = s.attention.find((n) => n.condition).id;
  s = reduce(s, { type: "review" });
  s = reduce(s, { type: "approve" });
  assert.equal(s.attention.find((n) => n.id === id).active, true);
  s = reduce(s, { type: "activate" });
  assert.equal(s.attention.find((n) => n.id === id).active, false);
  assert.ok(s.attention.some((n) => n.title === "Plan V2 activated"));
});
test("past conflicts disappear and mild weather does not claim restricted field window", () => {
  let s = reduce(w.initializeWorkflow(), { type: "advance", hours: 40 });
  assert.equal(
    w.attentionItems(s).some((n) => n.key.startsWith("conflicts")),
    false,
  );
  s = complete(
    reduce(w.initializeWorkflow(), {
      type: "apply-outlook",
      inputs: { ...m.BASE_INPUTS, weatherSeverity: 0.1 },
    }),
  );
  assert.equal(
    w.attentionItems(s, "forecast").some((n) => n.title === "Restricted field conditions forecast"),
    false,
  );
});
test("event notice precedes assessment; severe loss requests response not automatic proposal", () => {
  let s = generator();
  assert.equal(s.preparation.kind, "assessment");
  assert.equal(s.proposal, null);
  assert.equal(s.responseRequired, false);
  assert.ok(s.attention.some((n) => n.title === "Generator 01 capacity loss observed"));
  s = complete(s);
  assert.equal(s.responseRequired, true);
  assert.equal(s.proposal, null);
  const awaiting = reduce(s, { type: "generate" });
  assert.equal(awaiting.proposal, null);
  const ready = complete(awaiting);
  assert.equal(ready.proposal.kind, "adaptive");
  assert.equal(ready.proposal.feasible, true);
});
test("moderate loss needs no replacement and full loss blocks approval without claiming blackout", () => {
  let s = complete(generator(25));
  assert.equal(s.responseRequired, false);
  assert.equal(s.proposal, null);
  s = complete(generator(0));
  s = complete(reduce(s, { type: "generate" }));
  assert.equal(s.proposal.feasible, false);
  s = reduce(s, { type: "review" });
  assert.equal(reduce(s, { type: "approve" }), s);
  if (m.currentStation(s).criticalServed)
    assert.equal(
      w.attentionItems(s).some((n) => n.priority === "critical"),
      false,
    );
});
test("workflow persists acknowledgements and reload cancels pending work safely", () => {
  const s = changed();
  assert.deepEqual(w.restoreWorkflow(JSON.parse(JSON.stringify(s))), {
    ...s,
    playback: { ...s.playback, running: false, reason: "Restored case" },
  });
  const pending = reduce(w.initializeWorkflow(), { type: "generate" });
  const reload = w.restoreWorkflow(JSON.parse(JSON.stringify(pending)));
  assert.equal(reload.preparation, null);
  assert.equal(reload.proposal, null);
  assert.ok(reload.attention.some((n) => n.title === "Preparation interrupted by reload"));
});
test("connection and alert acknowledgements remain independent", () => {
  let s = changed();
  s = reduce(s, { type: "uplink" });
  const notice = s.attention.find((n) => n.key === "uplink-lost");
  s = reduce(s, { type: "ack-attention", id: notice.id });
  assert.equal(s.uplink, "lost");
  assert.equal(s.lastAcknowledgedHour, null);
  assert.equal(s.externalForecastHour, 0);
  assert.equal(
    s.records.some((r) => r.sync === "queued"),
    true,
  );
});
test("revised recording preserves resources at activation and completes five missions", () => {
  let s = complete(generator());
  s = complete(reduce(s, { type: "generate" }));
  const before = m.currentStation(s);
  s = authorize(s);
  assert.equal(m.currentStation(s).fuel, before.fuel);
  assert.equal(m.currentStation(s).battery, before.battery);
  s = reduce(s, { type: "advance", hours: 22 });
  assert.equal(s.activeVersion, 3);
  assert.equal(s.hour, 48);
  assert.equal(s.activeSchedule.filter((p) => m.missionProgress(s, p) === "Completed").length, 5);
  assert.ok(s.observations.every((p) => p.unserved === 0));
});
test("invalid workflow metadata safely rebuilds attention from a validated core case", () => {
  const s = w.initializeWorkflow();
  const raw = { ...s, attention: [{ id: "bad" }] };
  const restored = w.restoreWorkflow(raw);
  assert.equal(restored.activeVersion, 1);
  assert.equal(restored.attention.length, 1);
  assert.equal(restored.preparation, null);
});
test("failure and interrupted forecast retain the old published outlook and support retry", () => {
  let s = reduce(w.initializeWorkflow(), { type: "apply-outlook", inputs: m.RECORDING_INPUTS });
  const reload = w.restoreWorkflow(JSON.parse(JSON.stringify(s)));
  assert.equal(reload.failedPreparation, "forecast");
  assert.deepEqual(w.forecastCase(reload).inputs, m.BASE_INPUTS);
  s = reduce(s, { type: "fail-task", token: s.preparation.token });
  assert.equal(s.proposal, null);
  assert.equal(s.failedPreparation, "forecast");
  s = complete(reduce(s, { type: "retry-task" }));
  assert.equal(s.forecastReadyBasis, s.assumptionVersion);
  assert.equal(s.failedPreparation, null);
});
test("acknowledgements during preparation survive completion without restarting the task", () => {
  let s = reduce(w.initializeWorkflow(), { type: "generate" });
  const task = s.preparation,
    id = s.attention[0].id;
  s = reduce(s, { type: "ack-attention", id });
  assert.equal(s.preparation, task);
  s = complete(s);
  assert.equal(s.attention.find((n) => n.id === id).acknowledged, true);
});
test("activated proposal readiness leaves the attention queue but stays in history", () => {
  let s = complete(reduce(w.initializeWorkflow(), { type: "generate" }));
  const n = s.attention.find((n) => n.key.startsWith("proposal-"));
  assert.equal(n.planVersion, 2);
  s = authorize(s);
  assert.equal(
    w.attentionItems(s).some((n) => n.key.startsWith("proposal-")),
    false,
  );
  assert.ok(w.attentionItems(s, undefined, true).some((item) => item.id === n.id));
});
test("source wiring reserves lifecycle authorization for Planner and initializes applied inputs", () => {
  const source = readFileSync(
    new URL("../src/components/firn/presentation-workspace.tsx", import.meta.url),
    "utf8",
  );
  const operations = source.slice(
    source.indexOf("function Operations()"),
    source.indexOf("function Metric("),
  );
  const monitoring = source.slice(
    source.indexOf("function Monitor()"),
    source.indexOf("function Assets()"),
  );
  assert.equal(operations.includes("<ApprovalPanel"), false);
  assert.equal(monitoring.includes("<ApprovalPanel"), false);
  assert.ok(
    source
      .slice(source.indexOf("function Planner()"), source.indexOf("function ConstraintList()"))
      .includes("<ApprovalPanel"),
  );
  const simulator = readFileSync(
    new URL("../src/components/firn/recording-simulator.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(simulator.includes("...state.inputs"));
  assert.equal(simulator.includes("Weather severity percent"), false);
  assert.ok(simulator.includes("Original arrival"));
});

test("simulator event controls require explicit selection and distinguish current capacity", () => {
  const simulator = readFileSync(
    new URL("../src/components/firn/recording-simulator.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(simulator.includes("useState<number | null>(null)"));
  assert.ok(simulator.includes('value="">Select a disturbance…</option>'));
  assert.ok(simulator.includes("Current Generator 01 capacity: {format(c.g1Capacity)} kW"));
  assert.ok(simulator.includes('aria-label="Capacity after simulated event"'));
  assert.ok(simulator.includes('state.generatorEvent?.capacity ?? capacity ?? ""'));
  assert.ok(simulator.includes('e.target.value === "" ? null : Number(e.target.value)'));
  assert.match(simulator, /capacity === null\s*\|\|\s*state.hour < 26/);
  // Explicit null checks keep a deliberately selected 0 kW outage valid.
  assert.ok(
    simulator.includes('if (capacity !== null) dispatch({ type: "generator-event", capacity })'),
  );
  assert.ok(simulator.includes("setCapacity(null)"));
});
