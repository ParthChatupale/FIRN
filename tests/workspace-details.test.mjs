import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCaseStudies, workspaceDetails } from "../src/lib/workspace-details.ts";
import { initializeWorkflow, workflowReducer } from "../src/lib/recording-workflow.ts";

test("current case details are derived read-only from the actual workspace", () => {
  let state = initializeWorkflow();
  state = workflowReducer(state, { type: "set-playback-rate", rate: 30 });
  const before = JSON.stringify(state);
  const details = workspaceDetails(state);
  assert.equal(details.activeVersion, 1);
  assert.equal(details.completed, 0);
  assert.equal(details.deferred, 0);
  assert.equal(details.battery, 312);
  assert.equal(details.fuel, 1650);
  assert.equal(details.generatorCapacity, 80);
  assert.equal(details.proposal, "None");
  assert.equal(details.issueReports, 0);
  assert.equal(JSON.stringify(state), before);
});

test("case studies reproduce current model results without altering the selected case", () => {
  const state = initializeWorkflow();
  const before = JSON.stringify(state);
  const studies = buildCaseStudies();
  assert.equal(studies.length, 4);
  const [baseline, storm, severe, noGo] = studies;
  for (const projected of [baseline, storm]) {
    assert.equal(projected.stage, "projection");
    assert.equal(projected.scheduled, 6);
    assert.equal(projected.completed, 0);
    assert.equal(projected.feasible, true);
  }
  assert.equal(severe.stage, "execution");
  assert.equal(severe.generatorCapacity, 10);
  assert.equal(severe.completed, 5);
  assert.deepEqual(severe.deferred, ["Calibration"]);
  assert.equal(severe.feasible, true);
  assert.ok(severe.reserveMargin > 0);
  assert.ok(severe.fuelAtResupply > 300);
  assert.equal(noGo.stage, "no-go");
  assert.equal(noGo.generatorCapacity, 0);
  assert.equal(noGo.feasible, false);
  assert.ok(noGo.problems.length > 0);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(buildCaseStudies(), studies);
});

test("support pages use the current shell instead of silently mounting the backend workspace", () => {
  const shell = readFileSync(
    new URL("../src/components/firn/presentation-shell.tsx", import.meta.url),
    "utf8",
  );
  for (const route of ["/settings", "/about", "/case-studies"])
    assert.ok(shell.includes(`"${route}"`));
  assert.ok(shell.includes("<WorkspaceSupport path={path} />"));
  const support = readFileSync(
    new URL("../src/components/firn/workspace-support.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(!support.includes("firn-api"));
  assert.ok(!support.includes('type: "reset"'));
  assert.ok(support.includes('type: "set-playback-rate"'));
  assert.ok(support.includes('type: "set-lead-time"'));
});
