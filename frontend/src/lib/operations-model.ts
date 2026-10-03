import type { MonitoringSession, PlanVersion, SimulationRun, TelemetryPoint } from "./firn-api";

export type OperatingData = {
  run: SimulationRun | null;
  points: TelemetryPoint[];
  selectedPlan: PlanVersion | null;
  monitoredPlan: PlanVersion | null;
  session: MonitoringSession | null;
};

export function operatingSnapshot(data: OperatingData, reviewHour = 0) {
  const { run, points, selectedPlan, monitoredPlan, session } = data;
  // Monitoring owns the clock. A missing hour must never fall back to a future sample.
  const hour = session ? session.current_hour : points.length ? reviewHour : -1;
  const point = points.find((item) => item.hour === hour) ?? null;
  const activePlan =
    monitoredPlan?.status === "active"
      ? monitoredPlan
      : selectedPlan?.status === "active"
        ? selectedPlan
        : null;
  const referencePlan = activePlan ?? selectedPlan;
  const battery = run?.config_snapshot.station?.battery;
  const initial = !!run && hour === -1;
  const batteryKwh = point?.battery_kwh ?? (initial ? battery?.initial_kwh : null) ?? null;
  const fuel =
    point?.fuel_liters ??
    (initial ? run?.config_snapshot.station?.initial_fuel_liters : null) ??
    null;
  const reserve = battery?.reserve_kwh ?? null;
  const margin = batteryKwh !== null && reserve !== null ? batteryKwh - reserve : null;
  const critical = typeof point?.critical_violation === "boolean" ? point.critical_violation : null;
  const arrival =
    point?.resupply_arrival_hour ??
    (initial ? run?.config_snapshot.station?.fuel_resupply?.arrival_hour : null) ??
    null;
  const resupplyHours = arrival !== null ? Math.max(0, arrival - Math.max(0, hour)) : null;
  const runway = point?.fuel_runway_hours ?? null;
  const fuelPressure =
    runway !== null && resupplyHours !== null && resupplyHours > 0 && runway < resupplyHours;
  const currentEvents = session?.events.filter((event) => event.hour === hour) ?? [];
  const severe = currentEvents.some(
    (event) => event.severity === "critical" || event.severity === "high",
  );
  const posture: "action" | "setup" | "unobserved" | "watch" | "stable" =
    critical === true || (margin !== null && margin < -0.001) || severe
      ? "action"
      : !activePlan
        ? "setup"
        : critical === null || margin === null || fuel === null
          ? "unobserved"
          : fuelPressure ||
              (margin !== null && margin <= 0.001) ||
              !!session?.pending_proposal_id ||
              (!!session && monitoredPlan?.status !== "active")
            ? "watch"
            : "stable";
  return {
    hour,
    point,
    activePlan,
    referencePlan,
    batteryKwh,
    fuel,
    reserve,
    margin,
    critical,
    arrival,
    resupplyHours,
    runway,
    fuelPressure,
    currentEvents,
    posture,
    timestamp:
      point?.timestamp ??
      (initial ? (run?.config_snapshot.start_time ?? run?.started_at) : null) ??
      null,
    clockLabel: session
      ? hour < 0
        ? "Playback ready"
        : `Playback · H${hour}`
      : point
        ? `Case review · H${hour}`
        : "No observation",
  };
}

export function validateOperatingSelection(data: OperatingData) {
  const runId = data.run?.id;
  if (runId && data.session && data.session.simulation_run_id !== runId) {
    throw new Error(
      "Monitoring belongs to a different case. Choose a matching case in Scenario Lab.",
    );
  }
  for (const plan of [data.selectedPlan, data.monitoredPlan]) {
    if (runId && plan && plan.source_simulation_run_id !== runId) {
      throw new Error("The selected plan belongs to a different case. Choose a matching plan.");
    }
  }
  if (
    data.session &&
    data.monitoredPlan &&
    data.session.plan_version_id !== data.monitoredPlan.id
  ) {
    throw new Error("Monitoring and plan selections do not match.");
  }
}
