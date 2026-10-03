import test from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/lib/presentation-model.ts";
const reduce = m.presentationReducer;
function authorize(s) {
  for (const type of ["review", "approve", "activate"]) s = reduce(s, { type });
  return s;
}
function joint(s = m.initialPresentation()) {
  return authorize(reduce(s, { type: "generate" }));
}
function changed() {
  return joint(reduce(joint(), { type: "apply-outlook" }));
}
function event(capacity = 10) {
  let s = changed();
  s = reduce(s, { type: "advance", hours: 24 });
  s = reduce(s, { type: "observe-weather" });
  s = reduce(s, { type: "advance", hours: 2 });
  s = reduce(s, { type: "generator-event", capacity });
  if (capacity !== 25) s = reduce(s, { type: "generate" });
  return s;
}
function balance(rows, arrival) {
  for (let i = 0; i < rows.length; i++) {
    const p = rows[i];
    assert.ok(
      Math.abs(p.renewable + p.generator + p.discharge + p.unserved - p.demand - p.charge) < 0.01,
    );
    assert.ok(p.battery >= 99.99 && p.battery <= 400.01);
    assert.ok(p.fuel >= 0 && p.fuelRate >= 0 && p.fuelRate <= p.fuel + 0.003);
    assert.ok(p.g1 <= p.g1Capacity && p.g2 <= 45);
    assert.ok(!(p.charge > 0 && p.discharge > 0));
    if (i) {
      const prev = rows[i - 1],
        delivery = p.hour === arrival ? m.STATION.deliveryLitres : 0;
      assert.ok(
        Math.abs(p.battery - prev.battery - prev.charge * 0.94 + prev.discharge / 0.94) < 0.004,
      );
      assert.ok(Math.abs(p.fuel - prev.fuel + prev.fuelRate - delivery) < 0.004);
    }
  }
}
test("case is deterministic and isolated from backend storage", () => {
  assert.equal(m.PRESENTATION_KEY, "firn:presentation:v2");
  assert.deepEqual(
    m.stationTrajectory(m.initialPresentation()),
    m.stationTrajectory(m.initialPresentation()),
  );
  assert.equal(m.initialPresentation().activeKind, "original");
});
test("comparisons are derived: original has overlaps, joint retains six, energy defers flexible work", () => {
  const s = m.initialPresentation();
  assert.equal(m.conflictCount(s.activeSchedule), 2);
  assert.equal(m.conflictCount(m.candidateSchedule(s, "joint")), 0);
  assert.equal(m.candidateSchedule(s, "joint").filter((p) => !p.deferred).length, 6);
  assert.equal(m.candidateSchedule(s, "energy").filter((p) => p.deferred).length, 2);
  assert.equal(s.proposal, null);
});
test("future input changes projection, not any current observation or active version", () => {
  const before = joint(),
    after = reduce(before, { type: "apply-outlook" });
  assert.deepEqual(after.observations, before.observations);
  assert.deepEqual(after.activeSchedule, before.activeSchedule);
  assert.equal(m.arrivalHour(after), 144);
  assert.notDeepEqual(m.forecastRows(before), m.forecastRows(after));
  assert.notDeepEqual(m.stationTrajectory(before), m.stationTrajectory(after));
});
test("weather-only and logistics-only are independent bounded inputs", () => {
  const s = joint();
  const logistics = reduce(s, {
    type: "apply-outlook",
    inputs: { ...m.BASE_INPUTS, resupplyDelay: 3 },
  });
  assert.deepEqual(m.forecastRows(s), m.forecastRows(logistics));
  assert.notEqual(m.arrivalHour(s), m.arrivalHour(logistics));
  const weather = reduce(s, {
    type: "apply-outlook",
    inputs: { ...m.RECORDING_INPUTS, resupplyDelay: 0 },
  });
  assert.equal(m.arrivalHour(s), m.arrivalHour(weather));
  for (const inputs of [
    { ...m.BASE_INPUTS, weatherSeverity: NaN },
    { ...m.BASE_INPUTS, resupplyDelay: 9 },
    { ...m.BASE_INPUTS, weatherHour: 2 },
  ])
    assert.equal(reduce(s, { type: "apply-outlook", inputs }), s);
});
test("review, approve and activate are distinct, ordered transitions", () => {
  let s = reduce(m.initialPresentation(), { type: "generate" });
  assert.equal(reduce(s, { type: "approve" }), s);
  assert.equal(reduce(s, { type: "activate" }), s);
  assert.equal(reduce(s, { type: "advance", hours: 1 }), s);
  s = reduce(s, { type: "review" });
  s = reduce(s, { type: "approve" });
  assert.equal(s.activeVersion, 1);
  const next = reduce(s, { type: "activate" });
  assert.equal(next.activeVersion, 2);
  assert.equal(next.activeKind, "joint");
  assert.equal(m.currentStation(next).fuel, m.currentStation(s).fuel);
  assert.equal(m.currentStation(next).battery, m.currentStation(s).battery);
});
test("weather narrows field window; proposed schedules do not auto-activate", () => {
  const s = reduce(joint(), { type: "apply-outlook" });
  assert.equal(m.candidateSchedule(s, "weather").find((p) => p.id === "field").start, 7);
  assert.equal(s.activeSchedule.find((p) => p.id === "field").start, 8);
  assert.equal(m.planAssessment(s, m.candidateSchedule(s, "weather"), "weather").feasible, true);
});
test("time advance stops at weather checkpoint but does not invent an observation or generator event", () => {
  let s = reduce(changed(), { type: "advance", hours: 48 });
  assert.equal(s.hour, 24);
  assert.equal(s.observedWeather, null);
  assert.equal(s.generatorEvent, null);
  const prefix = s.observations.slice(0, 24),
    fuel = m.currentStation(s).fuel;
  s = reduce(s, { type: "observe-weather" });
  assert.deepEqual(s.observations.slice(0, 24), prefix);
  assert.equal(m.currentStation(s).fuel, fuel);
  assert.ok(m.currentStation(s).wind > 70);
  s = reduce(s, { type: "advance", hours: 2 });
  assert.equal(s.generatorEvent, null);
});
test("independent capacity loss proposes a feasible response preserving executed work", () => {
  let s = event();
  assert.equal(s.proposal.kind, "adaptive");
  assert.equal(s.proposal.feasible, true);
  assert.equal(s.proposal.schedule.find((p) => p.id === "survey").deferred, true);
  assert.equal(s.proposal.schedule.find((p) => p.id === "samples").start, 32);
  const prefix = s.observations.slice(0, 26),
    fuel = m.currentStation(s).fuel,
    battery = m.currentStation(s).battery;
  s = authorize(s);
  assert.equal(m.currentStation(s).fuel, fuel);
  assert.equal(m.currentStation(s).battery, battery);
  s = reduce(s, { type: "advance", hours: 22 });
  assert.deepEqual(s.observations.slice(0, 26), prefix);
  for (const id of ["field", "atmosphere", "lab", "water", "samples"])
    assert.equal(
      m.missionProgress(
        s,
        s.activeSchedule.find((p) => p.id === id),
      ),
      "Completed",
    );
  assert.equal(
    m.missionProgress(
      s,
      s.activeSchedule.find((p) => p.id === "survey"),
    ),
    "Deferred",
  );
  assert.ok(s.observations.every((p) => p.unserved === 0));
});
test("full outage is a controlled no-go; impossible proposal cannot be approved", () => {
  let s = event(0);
  assert.equal(s.proposal.feasible, false);
  s = reduce(s, { type: "review" });
  assert.equal(reduce(s, { type: "approve" }), s);
  const old = s.activeVersion;
  s = reduce(s, { type: "reject" });
  assert.equal(s.activeVersion, old);
});
test("moderate derating need not automatically create a replacement", () => {
  const s = event(25);
  assert.equal(s.derated, true);
  assert.equal(s.proposal, null);
});
test("references retain pre-event forecast after adaptive activation", () => {
  let s = event();
  const reference = m.monitoringReference(s)[26];
  assert.ok(reference.g1 > m.currentStation(s).g1);
  s = authorize(s);
  assert.deepEqual(m.monitoringReference(s)[26], reference);
});
test("all interval flows and closing inventories balance including delivery", () => {
  for (const severity of [0, 0.5, 0.85, 1])
    for (const delay of [0, 3, 5]) {
      let s = joint();
      s = reduce(s, {
        type: "apply-outlook",
        inputs: { ...m.RECORDING_INPUTS, weatherSeverity: severity, resupplyDelay: delay },
      });
      for (const kind of ["original", "energy", "joint", "weather", "adaptive"])
        balance(m.stationTrajectory(s, kind, false, 200), m.arrivalHour(s));
    }
  const s = authorize(event());
  balance(m.stationTrajectory(s, s.activeKind, false, 200).slice(26), m.arrivalHour(s));
});
test("observed interval replay balances and does not repaint past records", () => {
  const s = reduce(authorize(event()), { type: "advance", hours: 22 });
  balance(s.observations, m.arrivalHour(s));
});
test("adverse range is input-derived and not a fixed confidence multiplier", () => {
  const s = reduce(joint(), { type: "apply-outlook" });
  assert.notDeepEqual(
    m.forecastRows(s),
    m.forecastRows({ ...s, inputs: { ...s.inputs, uncertainty: 0.1 } }),
  );
  for (const row of m.forecastRows(s))
    if (row.range) assert.ok(row.range[0] <= row.expected && row.expected <= row.range[1]);
});
test("reconnect, forecast receipt and outbox acknowledgement have independent clocks", () => {
  let s = reduce(event(), { type: "uplink" });
  s = authorize(s);
  assert.ok(s.records.filter((r) => r.sync === "queued").length >= 4);
  assert.equal(reduce(s, { type: "receive-forecast" }), s);
  assert.equal(reduce(s, { type: "synchronize" }), s);
  s = reduce(s, { type: "advance", hours: 22 });
  assert.equal(s.externalForecastHour, 0);
  s = reduce(s, { type: "uplink" });
  assert.equal(s.externalForecastHour, 0);
  const count = s.records.filter((r) => r.sync === "queued").length;
  s = reduce(s, { type: "synchronize" });
  assert.equal(s.lastAcknowledgedHour, 48);
  assert.equal(s.externalForecastHour, 0);
  assert.equal(s.records.filter((r) => r.sync === "acknowledged").length, count);
  assert.equal(reduce(s, { type: "synchronize" }), s);
  s = reduce(s, { type: "receive-forecast" });
  assert.equal(s.externalForecastHour, 48);
});
test("valid reload retains final case; malformed and legacy state reset safely", () => {
  const original = m.initialPresentation(),
    final = reduce(authorize(event()), { type: "advance", hours: 22 });
  assert.deepEqual(m.restorePresentation(JSON.parse(JSON.stringify(final))), final);
  for (const bad of [
    null,
    {},
    { ...original, schema: 1 },
    { ...original, hour: NaN },
    { ...original, proposal: undefined },
    { ...original, activeKind: "adaptive" },
    { ...original, observations: [{ ...original.observations[0], demand: undefined }] },
    { ...original, records: [original.records[0], original.records[0]] },
    { ...original, generatorEvent: { hour: 26, capacity: 10 } },
  ])
    assert.deepEqual(m.restorePresentation(bad), original);
  assert.deepEqual(reduce(final, { type: "reset" }), original);
});
test("observations cannot complete double-booked work merely because its scheduled window ended", () => {
  const s = reduce(m.initialPresentation(), { type: "advance", hours: 48 });
  assert.ok(s.observations.some((p) => p.resourceHolds?.length));
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
    m.missionProgress(
      s,
      s.activeSchedule.find((m) => m.id === "atmosphere"),
    ),
    "Completed",
  );
});
