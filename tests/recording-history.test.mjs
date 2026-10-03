import test from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/lib/presentation-model.ts";
import * as w from "../src/lib/recording-workflow.ts";

const near = (a, b, tolerance = 0.002) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const complete = (s) =>
  w.workflowReducer(s, {
    type: "complete-task",
    token: s.preparation.token,
    elapsedMs: w.PREPARATION_MS[s.preparation.kind],
  });
function authorize(s) {
  for (const type of ["review", "approve", "activate"]) s = w.workflowReducer(s, { type });
  return s;
}
function active() {
  const s = complete(w.workflowReducer(w.initializeWorkflow(), { type: "apply-outlook" }));
  return authorize(complete(w.workflowReducer(s, { type: "generate" })));
}

test("48 prior hourly intervals have actual UTC dates and one unique H0 boundary", () => {
  const s = w.initializeWorkflow();
  const rows = m.observedHistory(s);
  assert.equal(rows.length, 49);
  assert.deepEqual(
    rows.map((p) => p.hour),
    Array.from({ length: 49 }, (_, i) => i - 48),
  );
  assert.match(m.stationTime(rows[0].hour), /13 Jan, 06:00 UTC/);
  assert.match(m.stationTime(rows.at(-1).hour), /15 Jan, 06:00 UTC/);
  assert.deepEqual(rows.at(-1), m.currentStation(s));
  assert.equal(s.observations.length, 1);
});

test("every historical interval balances power and integrates fuel and battery into H0", () => {
  const rows = m.observedHistory(m.initialPresentation());
  for (let i = 0; i < rows.length - 1; i++) {
    const p = rows[i],
      next = rows[i + 1];
    near(p.renewable + p.generator + p.discharge, p.demand + p.charge);
    near(p.generator, p.g1 + p.g2);
    near(p.availableRenewable, p.renewable + p.curtailed);
    near(p.fuelRate, m.fuelConsumption(p.g1, p.g2));
    near(next.battery, p.battery + p.charge * 0.94 - p.discharge / 0.94);
    near(next.fuel, p.fuel - p.fuelRate);
    assert.ok(p.battery >= m.STATION.batteryReserve && p.battery <= m.STATION.batteryCapacity);
    assert.ok(p.fuel >= m.STATION.protectedFuel);
    assert.ok(p.g1 >= 0 && p.g1 <= 80 && p.g2 >= 0 && p.g2 <= 45);
    assert.ok(p.charge >= 0 && p.charge <= 25 && p.discharge >= 0 && p.discharge <= 30);
    assert.ok(!(p.charge && p.discharge));
    assert.equal(p.unserved, 0);
    assert.equal(p.criticalServed, true);
    assert.equal(p.missionPower, 0);
    assert.deepEqual(p.runningMissions, []);
    assert.deepEqual(p.blockedMissions, []);
  }
  assert.equal(rows.at(-1).battery, 312);
  assert.equal(rows.at(-1).fuel, 1650);
  near(rows[0].fuel - rows.slice(0, -1).reduce((n, p) => n + p.fuelRate, 0), 1650);
});

test("negative timestamps use normalized daylight hours, not JavaScript negative remainder", () => {
  for (let h = -48; h < 0; h++) {
    const positiveDayHour = ((h % 24) + 24) % 24;
    // Cloud can vary between days; invert attenuation to compare the daylight factor.
    const cloud = 0.28 + 0.07 * Math.sin(h / 8);
    const daylight = 0.2 + 0.8 * Math.max(0, Math.sin(((positiveDayHour + 6) * Math.PI) / 12));
    near(
      m.environmentalPoint(h, m.BASE_INPUTS).solarPower,
      m.STATION.solarCapacity * daylight * (1 - 0.85 * cloud) * 0.9,
    );
  }
});

test("history is deterministic and returned arrays cannot corrupt later calls or case state", () => {
  const s = w.initializeWorkflow(),
    before = structuredClone(s);
  const baseline = m.preCaseHistory();
  const rows = m.observedHistory(s);
  rows[0].battery = 999;
  rows[0].runningMissions.push("field");
  rows.at(-1).battery = 0;
  rows.at(-1).runningMissions.push("field");
  assert.deepEqual(m.preCaseHistory(), baseline);
  assert.deepEqual(s, before);
});

test("future assumptions, proposal generation and activation never repaint pre-case history", () => {
  const expected = m.preCaseHistory();
  let s = w.initializeWorkflow();
  for (const action of [
    { type: "apply-outlook" },
    { type: "complete-task", token: 0 },
    { type: "generate" },
    { type: "review" },
    { type: "approve" },
    { type: "activate" },
  ]) {
    s = action.type === "complete-task" ? complete(s) : w.workflowReducer(s, action);
    if (s.preparation?.kind === "plan") s = complete(s);
    assert.deepEqual(
      m.observedHistory(s).filter((p) => p.hour < 0),
      expected,
    );
  }
  assert.equal(s.activeVersion, 2);
  assert.equal(s.hour, 0);
  assert.equal(
    Object.values(s.missionMinutes ?? {}).some((n) => n > 0),
    false,
  );
});

test("history merges minute-level current state without duplicating or consuming execution", () => {
  const s = w.workflowReducer(active(), { type: "advance-minutes", minutes: 17 });
  const before = structuredClone(s);
  const rows = m.observedHistory(s);
  assert.equal(rows.length, 50);
  assert.equal(rows.filter((p) => p.hour === 0).length, 1);
  near(rows.at(-1).hour, 17 / 60, 1e-9);
  assert.deepEqual(rows.at(-1), { ...m.currentStation(s), hour: 17 / 60 });
  assert.deepEqual(s, before);
  const restored = w.restoreWorkflow(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(m.observedHistory(restored), rows);
});

test("historical inspection leaves V2/V3 outcomes and supplied mission completion unchanged", () => {
  let s = active();
  assert.equal(s.proposal, null);
  assert.equal(m.resourceOutlook(s, s.activeKind).conflicts, 0);
  const expected = m.preCaseHistory();
  s = w.workflowReducer(s, { type: "advance", hours: 24 });
  assert.equal(s.records.filter((r) => r.type === "mission-completed").length, 4);
  s = w.workflowReducer(s, { type: "observe-weather" });
  s = w.workflowReducer(s, { type: "advance", hours: 2 });
  s = complete(w.workflowReducer(s, { type: "generator-event" }));
  s = authorize(complete(w.workflowReducer(s, { type: "generate" })));
  s = w.workflowReducer(s, { type: "advance", hours: 22 });
  const rows = m.observedHistory(s);
  assert.deepEqual(rows.slice(0, 48), expected);
  assert.equal(s.activeVersion, 3);
  assert.equal(s.hour, 48);
  near(m.currentStation(s).battery, 239.508, 0.003);
  near(m.currentStation(s).fuel, 1169.521, 0.003);
  assert.equal(
    s.activeSchedule.filter((mission) => m.missionProgress(s, mission) === "Completed").length,
    5,
  );
  assert.equal(s.activeSchedule.filter((mission) => mission.deferred).length, 1);
  assert.equal(rows.length, 97);
});
