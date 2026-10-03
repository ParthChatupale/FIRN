import type { MonitoringSession, PlanVersion, TelemetryPoint } from "./firn-api";

const states: Record<string, string> = {
  upcoming: "Upcoming",
  in_progress: "In progress",
  planned_window_elapsed: "Scheduled window ended",
  not_in_active_schedule: "Not scheduled",
  completed_before_checkpoint: "Completed before revision",
  no_event_yet: "No execution event recorded",
  mission_started: "Started",
  mission_completed: "Completed",
  mission_failed: "Failed",
  mission_deferred: "Deferred",
  mission_weather_interruption: "Weather interrupted",
  mission_power_shortfall: "Power shortfall",
};
export function missionState(value: unknown) {
  return typeof value === "string" ? (states[value] ?? value.replaceAll("_", " ")) : "Unavailable";
}
export function comparisonRows(
  points: TelemetryPoint[],
  plan: PlanVersion,
  session: MonitoringSession,
) {
  const origin = session.plan_origin_hour ?? 0;
  const dispatch = new Map((plan.plan_snapshot.dispatch ?? []).map((p) => [p.hour + origin, p]));
  return points
    .filter((p) => p.hour <= session.current_hour)
    .map((p) => ({
      ...p,
      planned_battery: dispatch.get(p.hour)?.battery_soc_kwh,
      planned_fuel: dispatch.get(p.hour)?.fuel_liters,
      planned_renewable: dispatch.get(p.hour)?.renewable_available_kw,
    }));
}
export function decisionPending(plan: PlanVersion | null) {
  return !!plan && ["proposed", "reviewed", "approved"].includes(plan.status);
}
