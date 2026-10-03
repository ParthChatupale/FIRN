import type { MonitoringSession, PlanVersion, SimulationRun, TelemetryPoint } from "./firn-api";

export type Preferences = {
  temperatureUnit: "C" | "F";
  windUnit: "km/h" | "m/s";
  timezone: "UTC" | "Asia/Kolkata";
  reducedMotion: boolean;
  playbackStep: number;
};
export type OperatorProfile = { name: string; role: "Station operator" | "Mission coordinator" };
export type WorkspaceSelection = {
  runId: string | null;
  planId: string | null;
  monitoringId: string | null;
};
export const defaultPreferences: Preferences = {
  temperatureUnit: "C",
  windUnit: "km/h",
  timezone: "UTC",
  reducedMotion: false,
  playbackStep: 1,
};
export const defaultOperator: OperatorProfile = { name: "Operator", role: "Station operator" };

/** Late writes from an old route must not select evidence under a newly chosen case. */
export function selectDependent(
  selection: WorkspaceSelection,
  kind: "planId" | "monitoringId",
  id: string | null,
  expectedRunId: string | null,
): WorkspaceSelection {
  if (selection.runId !== expectedRunId) return selection;
  return { ...selection, [kind]: selection.runId ? id : null };
}

export function readPreferences(value: unknown): Preferences {
  const p = value && typeof value === "object" ? (value as Partial<Preferences>) : {};
  return {
    temperatureUnit: p.temperatureUnit === "F" ? "F" : "C",
    windUnit: p.windUnit === "m/s" ? "m/s" : "km/h",
    timezone: p.timezone === "Asia/Kolkata" ? "Asia/Kolkata" : "UTC",
    reducedMotion: p.reducedMotion === true,
    playbackStep:
      typeof p.playbackStep === "number" &&
      Number.isInteger(p.playbackStep) &&
      p.playbackStep >= 1 &&
      p.playbackStep <= 24
        ? p.playbackStep
        : 1,
  };
}
export function readOperator(value: unknown): OperatorProfile {
  const p = value && typeof value === "object" ? (value as Partial<OperatorProfile>) : {};
  return {
    name: typeof p.name === "string" && p.name.trim() ? p.name.trim().slice(0, 80) : "Operator",
    role: p.role === "Mission coordinator" ? p.role : "Station operator",
  };
}
export function readSelection(value: unknown): WorkspaceSelection {
  const p = value && typeof value === "object" ? (value as Partial<WorkspaceSelection>) : {};
  const id = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const runId = id(p.runId);
  return {
    runId,
    planId: runId ? id(p.planId) : null,
    monitoringId: runId ? id(p.monitoringId) : null,
  };
}
export function selectRun(previous: WorkspaceSelection, runId: string | null): WorkspaceSelection {
  return runId === previous.runId ? previous : { runId, planId: null, monitoringId: null };
}
export function parseRecordTime(value: string | undefined | null): number | null {
  if (!value) return null;
  const stamp = Date.parse(/[zZ]$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`);
  return Number.isFinite(stamp) ? stamp : null;
}
export function formatRecordTime(
  value: string | undefined | null,
  timezone: Preferences["timezone"] = "UTC",
): string {
  const stamp = parseRecordTime(value);
  if (stamp === null) return "Time unavailable";
  return `${new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(stamp)} ${timezone === "UTC" ? "UTC" : "IST"}`;
}
export function formatTemperature(value: unknown, unit: Preferences["temperatureUnit"]): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${(unit === "F" ? (value * 9) / 5 + 32 : value).toFixed(1)} °${unit}`
    : "Temperature unavailable";
}
export function formatWind(value: unknown, unit: Preferences["windUnit"]): string {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? `${(unit === "m/s" ? value / 3.6 : value).toFixed(1)} ${unit}`
    : "Wind unavailable";
}
export function planMatchesRun(plan: PlanVersion, run: SimulationRun): boolean {
  if (plan.source_simulation_run_id)
    return plan.source_simulation_run_id === run.id && plan.station_name === run.station_name;
  return (
    plan.station_name === run.station_name &&
    plan.scenario === run.scenario &&
    plan.seed === run.seed &&
    plan.days === run.duration_days &&
    parseRecordTime(plan.simulation_start_time) === parseRecordTime(run.config_snapshot.start_time)
  );
}
export function sessionMatchesRun(session: MonitoringSession, run: SimulationRun): boolean {
  return session.simulation_run_id === run.id && session.station_name === run.station_name;
}
export function resolveCursor(
  run: SimulationRun | null,
  session: MonitoringSession | null,
  points: TelemetryPoint[],
) {
  if (
    run &&
    session &&
    (!Number.isInteger(session.current_hour) ||
      session.current_hour < -1 ||
      session.current_hour >= run.duration_days * 24)
  ) {
    return { hour: null, point: null, label: "Operating cursor unavailable", observed: false };
  }
  const observed = !!session && session.current_hour >= 0;
  const hour = run ? (observed ? session.current_hour : 0) : null;
  const point = hour === null ? null : (points.find((p) => p.hour === hour) ?? null);
  return {
    hour,
    point,
    label: !run ? "No operating case" : observed ? `Observation H${hour}` : "Prepared snapshot H0",
    observed,
  };
}
