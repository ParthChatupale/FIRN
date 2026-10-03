import type { PlanningMode } from "./firn-api";
export function readPlanningInputs(value: unknown): { mode: PlanningMode; flexibility: number } {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const mode = ["saved", "nominal", "adverse", "robust"].includes(String(record["mode"]))
    ? (record["mode"] as PlanningMode)
    : "saved";
  const flexibility =
    typeof record["flexibility"] === "number" &&
    Number.isInteger(record["flexibility"]) &&
    record["flexibility"] >= 0 &&
    record["flexibility"] <= 48
      ? record["flexibility"]
      : 12;
  return { mode, flexibility };
}
export function proposalRequestKey(runId: string, mode: PlanningMode, flexibility: number) {
  return `firn:proposal-request:${runId}:${mode}:${flexibility}`;
}
