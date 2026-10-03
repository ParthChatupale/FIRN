import test from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/lib/recording-engine.ts";
import * as w from "../src/lib/recording-workflow.ts";
const reduce = w.workflowReducer;
const clone = (s) => JSON.parse(JSON.stringify(s));
const complete = (s) =>
  reduce(s, {
    type: "complete-task",
    token: s.preparation.token,
    elapsedMs: w.PREPARATION_MS[s.preparation.kind],
  });
function authorize(s) {
  for (const type of ["review", "approve", "activate"]) s = reduce(s, { type });
  return s;
}
function active() {
  let s = complete(reduce(w.initializeWorkflow(), { type: "apply-outlook" }));
  return authorize(complete(reduce(s, { type: "generate" })));
}
function adaptive() {
  let s = reduce(active(), { type: "advance", hours: 24 });
  s = reduce(s, { type: "observe-weather" });
  s = reduce(s, { type: "advance", hours: 2 });
  s = complete(reduce(s, { type: "generator-event" }));
  return authorize(complete(reduce(s, { type: "generate" })));
}

test("baseline cannot play and task/activation checkpoints never auto-resume", () => {
  let s = w.initializeWorkflow();
  s = reduce(s, { type: "toggle-playback" });
  assert.equal(s.playback.running, false);
  assert.equal(s.hour, 0);
  s = active();
  assert.equal(s.playback.running, false);
  assert.match(s.playback.reason, /activated/);
  s = reduce(s, { type: "toggle-playback" });
  assert.equal(s.playback.running, true);
  s = reduce(s, { type: "generate" });
  assert.equal(s.playback.running, false);
  s = complete(s);
  assert.equal(s.playback.running, false);
});
test("minute progression integrates energy/fuel and does not invent hourly observations", () => {
  const s = active(),
    p = m.currentStation(s);
  const n = reduce(s, { type: "advance-minutes", minutes: 17 });
  assert.equal(n.hour, 0);
  assert.equal(n.minute, 17);
  assert.equal(n.observations.length, 1);
  assert.ok(
    Math.abs(
      m.currentStation(n).battery -
        (p.battery + (17 / 60) * (p.charge * 0.94 - p.discharge / 0.94)),
    ) < 1e-7,
  );
  assert.ok(Math.abs(m.currentStation(n).fuel - (p.fuel - (17 / 60) * p.fuelRate)) < 1e-7);
  assert.match(m.stationTime(m.stationHour(n)), /06:17/);
  assert.ok(m.stationTrajectory(n, n.activeKind, true).at(-1).hour > 0);
});
test("manual jumps and repeated playback ticks share the same physical trajectory", () => {
  const s = active();
  const manual = reduce(s, { type: "advance", hours: 8 });
  let ticks = reduce(s, { type: "toggle-playback" });
  for (let i = 0; i < 80; i++) ticks = reduce(ticks, { type: "tick", minutes: 6 });
  assert.equal(ticks.hour, 8);
  assert.equal(ticks.minute, 0);
  assert.deepEqual(ticks.observations, manual.observations);
  assert.deepEqual(ticks.missionMinutes, manual.missionMinutes);
  assert.deepEqual(ticks.records, manual.records);
});
test("clock pauses exactly at weather and asset boundaries without consuming extra minutes", () => {
  let s = reduce(active(), { type: "toggle-playback" });
  s = reduce(s, { type: "tick", minutes: 2000 });
  assert.equal(s.hour, 24);
  assert.equal(s.minute, 0);
  assert.equal(s.playback.running, false);
  assert.equal(reduce(s, { type: "toggle-playback" }).playback.running, false);
  const inventory = m.currentStation(s);
  s = reduce(s, { type: "observe-weather" });
  assert.equal(s.playback.running, false);
  assert.equal(m.currentStation(s).fuel, inventory.fuel);
  s = reduce(s, { type: "toggle-playback" });
  s = reduce(s, { type: "tick", minutes: 300 });
  assert.equal(s.hour, 26);
  assert.equal(s.minute, 0);
  assert.equal(s.playback.running, false);
  assert.match(s.playback.reason, /Asset/);
  s = reduce(s, { type: "generator-event" });
  assert.equal(s.playback.running, false);
  s = complete(s);
  assert.equal(s.responseRequired, true);
  assert.equal(s.proposal, null);
});
test("jump creates completion events at H10 H14 H18 H22, not H24", () => {
  const s = reduce(active(), { type: "advance", hours: 24 });
  const events = s.records.filter((r) => r.type === "mission-completed");
  assert.deepEqual(
    events.map((r) => r.hour),
    [10, 14, 18, 22],
  );
  assert.ok(events.every((r) => r.minute === 0));
  assert.equal(s.attention.filter((n) => n.key.startsWith("mission-completed-")).length, 4);
  assert.equal(
    m.missionProgress(
      s,
      s.activeSchedule.find((m) => m.id === "samples"),
    ),
    "Scheduled",
  );
});
test("reload/scene restore deduplicate completions and always pause without background catch-up", () => {
  const at24 = reduce(active(), { type: "advance", hours: 24 });
  let s = w.restoreWorkflow(clone(at24));
  assert.equal(s.playback.running, false);
  assert.equal(w.validSceneSnapshot(clone(s)), true);
  const count = s.records.filter((r) => r.type === "mission-completed").length;
  s = reduce(s, { type: "observe-weather" });
  s = reduce(s, { type: "advance-minutes", minutes: 10 });
  assert.equal(s.records.filter((r) => r.type === "mission-completed").length, count);
  const restored = reduce(s, { type: "restore-scene", snapshot: clone(at24) });
  assert.equal(restored.hour, 24);
  assert.equal(restored.minute, 0);
  assert.equal(restored.playback.running, false);
  assert.deepEqual(restored.observations, at24.observations);
});
test("running work gets minute credits; partial or unserved work never claims completion", () => {
  let s = reduce(active(), { type: "advance", hours: 7 });
  s = reduce(s, { type: "advance-minutes", minutes: 30 });
  assert.equal(m.missionServedMinutes(s, "field"), 30);
  assert.equal(m.missionProgress(s, s.activeSchedule[0]), "In progress");
  const p = m.currentStation(s);
  const blocked = { ...s, livePoint: { ...p, unserved: 2, criticalServed: false } };
  const n = m.stepStationMinute(blocked);
  assert.equal(m.missionServedMinutes(n, "field"), 30);
  assert.equal(m.missionProgress(n, n.activeSchedule[0]), "In progress");
});
test("fractional snapshot conserves current resources and rejects malformed live inventory", () => {
  const s = reduce(active(), { type: "advance-minutes", minutes: 17 });
  assert.deepEqual(m.currentStation(w.restoreWorkflow(clone(s))), m.currentStation(s));
  const bad = clone(s);
  bad.livePoint.fuel = -1;
  assert.equal(w.validSceneSnapshot(bad), false);
  assert.equal(reduce(s, { type: "restore-scene", snapshot: bad }), s);
  const bad2 = clone(s);
  bad2.attention[0].minute = 99;
  assert.equal(w.validSceneSnapshot(bad2), false);
});
test("restoring a scene invalidates old preparation completion tokens", () => {
  const saved = clone(active());
  let s = reduce(active(), { type: "generate" });
  const token = s.preparation.token;
  s = reduce(s, { type: "restore-scene", snapshot: saved });
  const old = reduce(s, { type: "complete-task", token, elapsedMs: 2500 });
  assert.equal(old, s);
  s = reduce(s, { type: "generate" });
  assert.notEqual(s.preparation.token, token);
});
test("new work has lead allowance; stale authorization is rejected, ongoing work preserved", () => {
  let s = reduce(active(), { type: "advance", hours: 7 });
  s = reduce(s, { type: "advance-minutes", minutes: 15 });
  const proposed = complete(reduce(s, { type: "generate" }));
  assert.deepEqual(
    proposed.proposal.schedule.find((m) => m.id === "field"),
    s.activeSchedule.find((m) => m.id === "field"),
  );
  for (const mission of proposed.proposal.schedule)
    if (
      !mission.deferred &&
      mission.id !== "field" &&
      m.missionProgress(s, mission) !== "Completed"
    )
      assert.ok(mission.start >= m.stationHour(s) + 0.5);
  let stale = complete(reduce(active(), { type: "generate" }));
  stale = reduce(stale, { type: "review" });
  stale.proposal = {
    ...stale.proposal,
    schedule: stale.proposal.schedule.map((m) => (m.id === "field" ? { ...m, start: 0 } : m)),
  };
  stale = reduce(stale, { type: "approve" });
  assert.equal(stale.proposal.status, "reviewed");
  assert.equal(stale.proposal.feasible, false);
  assert.equal(stale.activeVersion, 2);
});
test("H48 is a final stop; mission notifications do not pause ordinary playback", () => {
  let s = reduce(active(), { type: "toggle-playback" });
  s = reduce(s, { type: "tick", minutes: 600 });
  assert.equal(s.hour, 10);
  assert.equal(s.playback.running, true);
  assert.ok(s.records.some((r) => r.id === "mission-completed-field"));
  s = reduce(adaptive(), { type: "toggle-playback" });
  s = reduce(s, { type: "tick", minutes: 2000 });
  assert.equal(s.hour, 48);
  assert.equal(s.minute, 0);
  assert.equal(s.playback.running, false);
  assert.equal(
    s.activeSchedule.filter((mission) => m.missionProgress(s, mission) === "Completed").length,
    5,
  );
});
test("playback controls reject invalid deltas and proposal preparation freezes minute state", () => {
  const s = active();
  for (const minutes of [0, -1, 1.5, NaN, 3000])
    assert.equal(reduce(s, { type: "advance-minutes", minutes }), s);
  const preparing = reduce(s, { type: "generate" });
  assert.equal(reduce(preparing, { type: "advance-minutes", minutes: 1 }), preparing);
});
test("shared-team interruption cannot emit a false completion event", () => {
  const s = reduce(w.initializeWorkflow(), { type: "advance", hours: 34 });
  assert.equal(
    m.missionProgress(
      s,
      s.activeSchedule.find((m) => m.id === "lab"),
    ),
    "Incomplete",
  );
  assert.equal(
    m.missionProgress(
      s,
      s.activeSchedule.find((m) => m.id === "survey"),
    ),
    "Incomplete",
  );
  assert.equal(
    s.records.some((r) => r.id === "mission-completed-lab"),
    false,
  );
  assert.equal(
    s.records.some((r) => r.id === "mission-completed-survey"),
    false,
  );
});
test("minute integration retains hourly opening inventory recurrence over the entire recording", () => {
  let s = reduce(adaptive(), { type: "advance", hours: 22 });
  for (let h = 0; h < 48; h++) {
    const a = s.observations[h],
      b = s.observations[h + 1];
    assert.ok(
      Math.abs(b.battery - (a.battery + a.charge * 0.94 - a.discharge / 0.94)) < 0.003,
      `battery H${h}`,
    );
    assert.ok(Math.abs(b.fuel - (a.fuel - a.fuelRate)) < 0.003, `fuel H${h}`);
    assert.ok(
      Math.abs(a.renewable + a.generator + a.discharge + a.unserved - a.demand - a.charge) < 0.01,
    );
  }
});
test("approval and activation both enforce lead time and full scene restoration keeps outbox", () => {
  let s = complete(reduce(active(), { type: "generate" }));
  s = reduce(s, { type: "review" });
  s = reduce(s, { type: "approve" });
  s.proposal = {
    ...s.proposal,
    schedule: s.proposal.schedule.map((m) => (m.id === "field" ? { ...m, start: 0 } : m)),
  };
  const rejected = reduce(s, { type: "activate" });
  assert.equal(rejected.activeVersion, 2);
  assert.ok(rejected.proposal.problems.some((p) => p.includes("margin")));
  const disconnected = reduce(adaptive(), { type: "uplink" });
  const saved = clone(disconnected);
  const later = reduce(disconnected, { type: "advance-minutes", minutes: 20 });
  const restored = reduce(later, { type: "restore-scene", snapshot: saved });
  assert.equal(restored.uplink, "lost");
  assert.deepEqual(restored.records, saved.records);
  assert.deepEqual(restored.attention, saved.attention);
  assert.deepEqual(restored.missionMinutes, saved.missionMinutes);
});
