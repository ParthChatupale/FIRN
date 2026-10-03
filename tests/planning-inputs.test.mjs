import test from "node:test";
import assert from "node:assert/strict";
import { readPlanningInputs, proposalRequestKey } from "../src/lib/planning-inputs.ts";
import { selectDependent } from "../src/lib/workspace-model.ts";
test("proposal inputs survive a remount and corrupt preferences use defaults", () => {
  assert.deepEqual(
    readPlanningInputs(JSON.parse(JSON.stringify({ mode: "robust", flexibility: 0 }))),
    { mode: "robust", flexibility: 0 },
  );
  assert.deepEqual(readPlanningInputs({ mode: "magic", flexibility: -2 }), {
    mode: "saved",
    flexibility: 12,
  });
  assert.deepEqual(readPlanningInputs(null), { mode: "saved", flexibility: 12 });
});
test("retry identity changes only with planning inputs", () => {
  assert.equal(proposalRequestKey("r", "robust", 12), proposalRequestKey("r", "robust", 12));
  for (const key of [
    proposalRequestKey("r2", "robust", 12),
    proposalRequestKey("r", "nominal", 12),
    proposalRequestKey("r", "robust", 0),
  ])
    assert.notEqual(key, proposalRequestKey("r", "robust", 12));
});
test("late proposal or session completion cannot pollute a newly chosen case", () => {
  const current = { runId: "new", planId: null, monitoringId: null };
  for (const kind of ["planId", "monitoringId"]) {
    assert.equal(selectDependent(current, kind, "old-result", "old"), current);
    assert.equal(selectDependent(current, kind, "matched", "new")[kind], "matched");
  }
});
