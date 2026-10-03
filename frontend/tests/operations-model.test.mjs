import test from "node:test";
import assert from "node:assert/strict";
import { operatingSnapshot, validateOperatingSelection } from "../src/lib/operations-model.ts";

const point = (hour, overrides = {}) => ({
  hour,
  timestamp: `2032-01-01T${String(hour).padStart(2, "0")}:00:00Z`,
  battery_kwh: 80,
  fuel_liters: 1000,
  critical_violation: false,
  resupply_arrival_hour: 48,
  fuel_runway_hours: 100,
  ...overrides,
});
const plan = (id = "plan", status = "active", source = "run") => ({
  id,
  status,
  source_simulation_run_id: source,
});
const data = (overrides = {}) => ({
  run: {
    id: "run",
    started_at: "2032-01-01T00:00:00Z",
    config_snapshot: {
      station: { battery: { reserve_kwh: 50, initial_kwh: 100 }, initial_fuel_liters: 1200 },
      start_time: "2032-01-01T00:00:00Z",
    },
  },
  points: [point(0), point(6, { battery_kwh: 65 })],
  selectedPlan: plan(),
  monitoredPlan: null,
  session: null,
  ...overrides,
});

test("review starts at hour zero, never the final summary", () => {
  const s = operatingSnapshot(data());
  assert.equal(s.hour, 0);
  assert.equal(s.batteryKwh, 80);
  assert.equal(s.margin, 30);
});
test("explicit case review updates the same-hour margins and clock", () => {
  const s = operatingSnapshot(data(), 6);
  assert.equal(s.hour, 6);
  assert.equal(s.batteryKwh, 65);
  assert.equal(s.resupplyHours, 42);
  assert.match(s.clockLabel, /Case review/);
});
test("missing review hour is unavailable, never a future sample", () => {
  const s = operatingSnapshot(data(), 5);
  assert.equal(s.batteryKwh, null);
  assert.equal(s.fuel, null);
  assert.equal(s.critical, null);
  assert.equal(s.posture, "unobserved");
});
test("monitoring owns the clock, independently of the review cursor", () => {
  const s = operatingSnapshot(
    data({
      session: { current_hour: 6, events: [], plan_version_id: "plan" },
      monitoredPlan: plan(),
    }),
    0,
  );
  assert.equal(s.hour, 6);
  assert.equal(s.batteryKwh, 65);
});
test("a ready session uses the initial configuration, not hour-zero results", () => {
  const s = operatingSnapshot(data({ session: { current_hour: -1, events: [] } }));
  assert.equal(s.batteryKwh, 100);
  assert.equal(s.fuel, 1200);
  assert.equal(s.critical, null);
  assert.equal(s.posture, "unobserved");
});
test("protected-reserve and critical violations outrank setup", () => {
  for (const changes of [{ battery_kwh: 40 }, { critical_violation: true }]) {
    const s = operatingSnapshot(data({ selectedPlan: null, points: [point(0, changes)] }));
    assert.equal(s.posture, "action");
  }
});
test("a proposed plan is not represented as active", () => {
  const s = operatingSnapshot(data({ selectedPlan: plan("proposal", "proposed") }));
  assert.equal(s.activePlan, null);
  assert.equal(s.posture, "setup");
});
test("the monitored active plan is retained while a revision is selected", () => {
  const s = operatingSnapshot(
    data({
      selectedPlan: plan("revision", "proposed"),
      monitoredPlan: plan(),
      session: { current_hour: 0, events: [], pending_proposal_id: "revision" },
    }),
  );
  assert.equal(s.activePlan.id, "plan");
  assert.equal(s.referencePlan.id, "plan");
  assert.equal(s.posture, "watch");
});
test("historical critical records are not current unresolved alarms", () => {
  const s = operatingSnapshot(
    data({
      monitoredPlan: plan(),
      session: { current_hour: 6, events: [{ hour: 0, severity: "critical" }] },
    }),
  );
  assert.equal(s.currentEvents.length, 0);
  assert.equal(s.posture, "stable");
});
test("a severe event at the displayed hour requires attention", () => {
  const s = operatingSnapshot(
    data({
      monitoredPlan: plan(),
      session: { current_hour: 6, events: [{ hour: 6, severity: "high" }] },
    }),
  );
  assert.equal(s.posture, "action");
});
test("fuel pressure compares recent-consumption runway with delivery wait", () => {
  const s = operatingSnapshot(data({ points: [point(0, { fuel_runway_hours: 24 })] }));
  assert.equal(s.fuelPressure, true);
  assert.equal(s.posture, "watch");
});
test("unavailable runway or delivery is not invented", () => {
  const s = operatingSnapshot(
    data({ points: [point(0, { fuel_runway_hours: null, resupply_arrival_hour: null })] }),
  );
  assert.equal(s.runway, null);
  assert.equal(s.resupplyHours, null);
  assert.equal(s.fuelPressure, false);
});
test("missing safety evidence cannot yield a stable badge", () => {
  const s = operatingSnapshot(data({ points: [point(0, { battery_kwh: undefined })] }));
  assert.equal(s.margin, null);
  assert.equal(s.posture, "unobserved");
});
test("superseded session reference is a watch state", () => {
  const s = operatingSnapshot(
    data({ monitoredPlan: plan("old", "superseded"), session: { current_hour: 0, events: [] } }),
  );
  assert.equal(s.posture, "watch");
});
test("cross-case selections and unlinked plans are rejected", () => {
  assert.throws(
    () => validateOperatingSelection(data({ session: { simulation_run_id: "other" } })),
    /different case/,
  );
  assert.throws(
    () => validateOperatingSelection(data({ selectedPlan: plan("plan", "active", "other") })),
    /different case/,
  );
  assert.throws(
    () => validateOperatingSelection(data({ selectedPlan: plan("plan", "active", null) })),
    /different case/,
  );
});
test("monitoring cannot reference a different loaded plan", () => {
  assert.throws(
    () =>
      validateOperatingSelection(
        data({
          monitoredPlan: plan("wrong"),
          session: { simulation_run_id: "run", plan_version_id: "right" },
        }),
      ),
    /do not match/,
  );
});
