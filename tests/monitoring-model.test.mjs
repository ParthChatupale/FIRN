import test from "node:test";
import assert from "node:assert/strict";
import { comparisonRows, missionState, decisionPending } from "../src/lib/monitoring-model.ts";

test("operator-readable mission states do not invent completed work", () => {
  assert.equal(missionState("no_event_yet"), "No execution event recorded");
  assert.equal(missionState("not_in_active_schedule"), "Not scheduled");
  assert.equal(missionState("mission_completed"), "Completed");
  assert.equal(missionState(null), "Unavailable");
});
test("only outstanding lifecycle states pause the decision clock", () => {
  for (const status of ["proposed", "reviewed", "approved"])
    assert.equal(decisionPending({ status }), true);
  for (const status of ["active", "rejected", "superseded"])
    assert.equal(decisionPending({ status }), false);
  assert.equal(decisionPending(null), false);
});
test("replacement references align to absolute time and never repaint earlier history", () => {
  const rows = comparisonRows(
    [{ hour: 8 }, { hour: 9 }, { hour: 10 }, { hour: 11 }],
    {
      plan_snapshot: {
        dispatch: [
          { hour: 0, battery_soc_kwh: 150 },
          { hour: 1, battery_soc_kwh: 140 },
        ],
      },
    },
    { current_hour: 10, plan_origin_hour: 10 },
  );
  assert.equal(rows.length, 3);
  assert.equal(rows[0].planned_battery, undefined);
  assert.equal(rows[1].planned_battery, undefined);
  assert.equal(rows[2].planned_battery, 150);
});
