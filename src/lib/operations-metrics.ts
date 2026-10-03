import type { TelemetryPoint, PlanVersion, SimulationRun, PlanDispatchPoint } from "./firn-api";

export function nextDecision(
  plan: Pick<PlanVersion, "status"> | null,
  pendingId: string | null | undefined,
) {
  if (pendingId) return { label: "Review checkpoint proposal", route: "/monitoring" as const };
  if (plan?.status === "active") return { label: "Open monitoring", route: "/monitoring" as const };
  const labels = {
    proposed: "Review selected proposal",
    reviewed: "Approve or reject proposal",
    approved: "Activate approved proposal",
    rejected: "Select another proposal",
    superseded: "Select another proposal",
  };
  return {
    label: plan ? labels[plan.status as keyof typeof labels] : "Generate joint proposal",
    route: "/mission-planner" as const,
  };
}

export function planEnergyRow(point: PlanDispatchPoint) {
  const generators = point.generator_output_kw;
  const generator = generators ? Object.values(generators).reduce((a, b) => a + b, 0) : null;
  return {
    ...point,
    generator_total_kw: generator,
    supply_kw:
      generator !== null &&
      typeof point.renewable_used_kw === "number" &&
      typeof point.battery_discharge_kw === "number"
        ? generator + point.renewable_used_kw + point.battery_discharge_kw
        : null,
  };
}

export function numberLabel(value: unknown, digits = 1): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-GB", { maximumFractionDigits: digits })
    : "—";
}
export function energyRow(point: TelemetryPoint) {
  const generators = point.generator_output_kw;
  const generator = generators ? Object.values(generators).reduce((a, b) => a + b, 0) : null;
  const known = generator !== null && typeof point.battery_discharge_kw === "number";
  return {
    ...point,
    generator_kw: generator,
    supply_kw: known ? point.renewable_kw + generator + point.battery_discharge_kw! : null,
    discharge_kw: point.battery_discharge_kw ?? null,
  };
}
export function resourceMetrics(run: SimulationRun, point: TelemetryPoint | null) {
  const reserve = run.config_snapshot.station.battery.reserve_kwh;
  return {
    margin: point && Number.isFinite(point.battery_kwh) ? point.battery_kwh - reserve : null,
    runway:
      typeof point?.fuel_runway_hours === "number" && Number.isFinite(point.fuel_runway_hours)
        ? point.fuel_runway_hours
        : null,
    resupply:
      typeof point?.resupply_arrival_hour === "number"
        ? Math.max(0, point.resupply_arrival_hour - point.hour)
        : null,
    critical: typeof point?.critical_violation === "boolean" ? !point.critical_violation : null,
  };
}
export function planScopeCompatible(a: PlanVersion, b: PlanVersion) {
  return (
    a.plan_group_id === b.plan_group_id &&
    a.days === b.days &&
    a.simulation_start_time === b.simulation_start_time &&
    a.source_simulation_run_id === b.source_simulation_run_id
  );
}
