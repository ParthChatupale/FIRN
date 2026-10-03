import test from "node:test";
import assert from "node:assert/strict";
import {
  readPreferences,
  readOperator,
  readSelection,
  selectRun,
  parseRecordTime,
  formatRecordTime,
  formatTemperature,
  formatWind,
  planMatchesRun,
  sessionMatchesRun,
  resolveCursor,
  defaultPreferences,
} from "../src/lib/workspace-model.ts";

const run = {
  id: "run-a",
  station_name: "Alpha",
  scenario: "normal",
  seed: 42,
  duration_days: 2,
  config_snapshot: { start_time: "2026-01-01T00:00:00" },
};
const plan = {
  source_simulation_run_id: "run-a",
  station_name: "Alpha",
  scenario: "normal",
  seed: 42,
  days: 2,
  simulation_start_time: "2026-01-01T00:00:00Z",
};
const points = [
  { hour: 0, temperature_c: -18, wind_kmh: 0 },
  { hour: 1, temperature_c: -20 },
  { hour: 47, temperature_c: -30 },
];
test("invalid preferences have safe defaults", () =>
  assert.deepEqual(
    readPreferences({
      playbackStep: 99,
      windUnit: "mph",
      timezone: "Invalid",
      reducedMotion: "yes",
    }),
    defaultPreferences,
  ));
test("supported preferences round trip including zero-independent settings", () => {
  const p = {
    temperatureUnit: "F",
    windUnit: "m/s",
    timezone: "Asia/Kolkata",
    reducedMotion: true,
    playbackStep: 12,
  };
  assert.deepEqual(readPreferences(JSON.parse(JSON.stringify(p))), p);
});
test("fractional playback steps cannot be saved", () =>
  assert.equal(readPreferences({ playbackStep: 1.5 }).playbackStep, 1));
test("operator identity is trimmed and unknown roles do not grant privileges", () =>
  assert.deepEqual(readOperator({ name: "  Pat  ", role: "Administrator" }), {
    name: "Pat",
    role: "Station operator",
  }));
test("blank identity uses an explicit presentation default", () =>
  assert.equal(readOperator({ name: "  " }).name, "Operator"));
test("run switching clears dependent selections atomically", () =>
  assert.deepEqual(selectRun({ runId: "a", planId: "p", monitoringId: "m" }, "b"), {
    runId: "b",
    planId: null,
    monitoringId: null,
  }));
test("selecting the same run preserves its workflow", () => {
  const p = { runId: "a", planId: "p", monitoringId: "m" };
  assert.equal(selectRun(p, "a"), p);
});
test("clearing the run clears only selection, not records", () =>
  assert.deepEqual(selectRun({ runId: "a", planId: "p", monitoringId: "m" }, null), {
    runId: null,
    planId: null,
    monitoringId: null,
  }));
test("malformed persisted selections cannot restore orphan dependencies", () =>
  assert.deepEqual(readSelection({ runId: null, planId: "p", monitoringId: "m" }), {
    runId: null,
    planId: null,
    monitoringId: null,
  }));
test("prepared clock is H0 rather than final run hour", () =>
  assert.equal(resolveCursor(run, null, points).point.hour, 0));
test("not-yet-started monitoring uses the labeled prepared snapshot", () => {
  const cursor = resolveCursor(run, { current_hour: -1 }, points);
  assert.equal(cursor.point.hour, 0);
  assert.equal(cursor.observed, false);
  assert.match(cursor.label, /Prepared/);
});
test("monitoring uses exact cursor and never nearest/future fallback", () => {
  assert.equal(resolveCursor(run, { current_hour: 1 }, points).point.hour, 1);
  assert.equal(resolveCursor(run, { current_hour: 2 }, points).point, null);
});
test("no case means no invented measurement", () =>
  assert.equal(resolveCursor(null, null, points).point, null));
test("invalid monitoring cursors never fall back to a prepared reading", () => {
  for (const current_hour of [-2, NaN, 0.5, Infinity, run.duration_days * 24]) {
    const cursor = resolveCursor(run, { current_hour }, points);
    assert.equal(cursor.point, null);
    assert.equal(cursor.hour, null);
    assert.match(cursor.label, /unavailable/);
  }
});
test("zero and negative temperature are valid", () => {
  assert.equal(formatTemperature(0, "C"), "0.0 °C");
  assert.equal(formatTemperature(-40, "F"), "-40.0 °F");
});
test("wind conversion preserves calm conditions and rejects invalid values", () => {
  assert.equal(formatWind(0, "m/s"), "0.0 m/s");
  assert.equal(formatWind(36, "m/s"), "10.0 m/s");
  assert.match(formatWind(-1, "km/h"), /unavailable/);
  assert.match(formatWind(NaN, "km/h"), /unavailable/);
});
test("missing values do not become zero", () => {
  assert.match(formatTemperature(null, "C"), /unavailable/);
  assert.match(formatWind(undefined, "km/h"), /unavailable/);
});
test("offset-free backend timestamps are consistently UTC", () =>
  assert.equal(parseRecordTime("2026-01-01T00:00:00"), parseRecordTime("2026-01-01T00:00:00Z")));
test("timezone formatting is explicit", () => {
  assert.match(formatRecordTime("2026-01-01T00:00:00Z", "UTC"), /00:00 UTC/);
  assert.match(formatRecordTime("2026-01-01T00:00:00Z", "Asia/Kolkata"), /05:30 IST/);
  assert.equal(formatRecordTime("bad"), "Time unavailable");
});
test("linked proposals must match case and station", () => {
  assert.equal(planMatchesRun(plan, run), true);
  assert.equal(planMatchesRun({ ...plan, source_simulation_run_id: "other" }, run), false);
  assert.equal(planMatchesRun({ ...plan, station_name: "Beta" }, run), false);
});
test("monitoring session linkage requires both case and station", () => {
  const session = { simulation_run_id: run.id, station_name: run.station_name };
  assert.equal(sessionMatchesRun(session, run), true);
  assert.equal(sessionMatchesRun({ ...session, simulation_run_id: "other" }, run), false);
  assert.equal(sessionMatchesRun({ ...session, station_name: "Beta" }, run), false);
});
test("legacy unlinked proposals require matching scenario/seed/horizon/time", () => {
  assert.equal(planMatchesRun({ ...plan, source_simulation_run_id: null }, run), true);
  assert.equal(planMatchesRun({ ...plan, source_simulation_run_id: null, seed: 99 }, run), false);
});
