import test from "node:test";
import assert from "node:assert/strict";
import {
  energyRow,
  nextDecision,
  planEnergyRow,
  numberLabel,
  resourceMetrics,
  planScopeCompatible,
} from "../src/lib/operations-metrics.ts";
test("total supply includes generators and battery discharge, not battery charge", () => {
  const row = energyRow({
    renewable_kw: 20,
    generator_output_kw: { a: 40, b: 10 },
    battery_discharge_kw: 5,
    battery_charge_kw: 12,
  });
  assert.equal(row.supply_kw, 75);
  assert.equal(row.generator_kw, 50);
});
test("planned supply uses dispatched, not available, renewables and includes battery output", () => {
  assert.equal(
    planEnergyRow({
      renewable_used_kw: 10,
      renewable_available_kw: 40,
      generator_output_kw: { a: 20 },
      battery_discharge_kw: 5,
    }).supply_kw,
    35,
  );
  assert.equal(planEnergyRow({ renewable_used_kw: 10 }).supply_kw, null);
});
test("next-decision actions target the workspace that actually owns the decision", () => {
  assert.equal(nextDecision(null, null).route, "/mission-planner");
  assert.equal(nextDecision({ status: "active" }, null).route, "/monitoring");
  assert.deepEqual(nextDecision({ status: "active" }, "checkpoint"), {
    label: "Review checkpoint proposal",
    route: "/monitoring",
  });
  for (const status of ["proposed", "reviewed", "approved"])
    assert.equal(nextDecision({ status }, null).route, "/mission-planner");
});
test("missing contribution cannot silently become zero total supply", () => {
  assert.equal(energyRow({ renewable_kw: 20 }).supply_kw, null);
  assert.equal(energyRow({ renewable_kw: 20, generator_output_kw: {} }).supply_kw, null);
  assert.equal(
    energyRow({ renewable_kw: 0, generator_output_kw: {}, battery_discharge_kw: 0 }).supply_kw,
    0,
  );
});
test("resources are current-hour values and negative reserve margin is retained", () => {
  const metrics = resourceMetrics(
    { config_snapshot: { station: { battery: { reserve_kwh: 90 } } } },
    {
      hour: 12,
      battery_kwh: 85,
      fuel_runway_hours: 0,
      resupply_arrival_hour: 84,
      critical_violation: false,
    },
  );
  assert.deepEqual(metrics, { margin: -5, runway: 0, resupply: 72, critical: true });
});
test("unknown runway and critical status stay unknown", () => {
  const metrics = resourceMetrics(
    { config_snapshot: { station: { battery: { reserve_kwh: 90 } } } },
    null,
  );
  assert.deepEqual(metrics, { margin: null, runway: null, resupply: null, critical: null });
  assert.equal(numberLabel(NaN), "—");
  assert.equal(numberLabel(0), "0");
  assert.equal(numberLabel(-2.14), "-2.1");
});
test("comparison rejects different case, group, origin or horizon", () => {
  const a = {
    plan_group_id: "g",
    days: 2,
    simulation_start_time: "t",
    source_simulation_run_id: "r",
  };
  assert.equal(planScopeCompatible(a, { ...a }), true);
  for (const patch of [
    { days: 1 },
    { simulation_start_time: "new" },
    { source_simulation_run_id: "other" },
    { plan_group_id: "other" },
  ])
    assert.equal(planScopeCompatible(a, { ...a, ...patch }), false);
});
