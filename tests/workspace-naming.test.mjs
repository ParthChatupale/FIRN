import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { WORKFLOW_KEY } from "../src/lib/recording-workflow.ts";
import { PRESENTATION_KEY } from "../src/lib/recording-engine.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("project metadata consistently uses the FIRN package name", () => {
  const pkg = JSON.parse(read("package.json"));
  const npm = JSON.parse(read("package-lock.json"));
  const bun = ts.parseConfigFileTextToJson("bun.lock", read("bun.lock"));
  assert.equal(bun.error, undefined);
  assert.equal(pkg.name, "firn-polar-ops");
  assert.equal(npm.name, pkg.name);
  assert.equal(npm.packages[""].name, pkg.name);
  assert.equal(bun.config.workspaces[""].name, pkg.name);
  assert.ok(pkg.scripts["test:simulation"]);
  assert.equal(pkg.scripts["test:presentation"], "npm run test:simulation");
});

test("operator-facing copy uses standard workspace and simulation labels", () => {
  const controls = read("src/components/firn/recording-playback.tsx");
  assert.ok(controls.includes("Simulation Controls"));
  assert.ok(controls.includes("Save workspace snapshot"));
  assert.ok(controls.includes("Restore snapshot"));
  for (const old of [
    "Rehearsal controls only",
    "Close rehearsal controls",
    "Scene name",
    "current recording case",
  ])
    assert.ok(!controls.includes(old));
  const shell = read("src/components/firn/presentation-shell.tsx");
  assert.ok(shell.includes("Workspace boundaries"));
  assert.ok(!shell.includes("Presentation boundary"));
  const support = read("src/components/firn/workspace-support.tsx");
  assert.ok(support.includes("Workspace storage & saved snapshots"));
  assert.ok(!support.includes("Demonstration only"));
  // Names are presentation only: existing browser data keys remain readable.
  assert.equal(WORKFLOW_KEY, "firn:presentation:v3");
  assert.equal(PRESENTATION_KEY, "firn:presentation:v2");
  assert.ok(read("src/lib/presentation-context.tsx").includes("firn:rehearsal:scenes:v1"));
});
