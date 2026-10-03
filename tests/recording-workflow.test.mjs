import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as w from "../src/lib/recording-workflow.ts";
import * as m from "../src/lib/recording-engine.ts";
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
