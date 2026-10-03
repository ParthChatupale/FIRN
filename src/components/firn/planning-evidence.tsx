import type { PlanVersion, SimulationRun } from "@/lib/firn-api";
import { numberLabel } from "@/lib/operations-metrics";

export function PlanningFailureDetail({ detail }: { detail: unknown }) {
  if (!detail || typeof detail !== "object") return null;
  const result = detail as Record<string, unknown>;
  const diagnostics = result["diagnostics"] as Record<string, unknown> | undefined;
  if (!diagnostics) return null;
  const bottlenecks = diagnostics["likely_power_bottlenecks"] as
    Array<Record<string, unknown>> | undefined;
  const blocked = diagnostics["missions_without_weather_and_deadline_eligible_starts"] as
    unknown[] | undefined;
  const dropped = diagnostics["missions_not_retained"] as string[] | undefined;
  if (dropped?.length)
    return (
      <div className="mt-3 text-xs text-foreground">
        <h3 className="font-semibold">No-go: timing edit would drop required work</h3>
        <p className="mt-2">
          Not retained: {dropped.join(", ")}. {String(diagnostics["note"])}
        </p>
        <p className="mt-2">The previously selected plan remains unchanged.</p>
      </div>
    );
  return (
    <div className="mt-3 space-y-2 text-xs text-foreground">
      <h3 className="font-semibold">
        {result["code"] === "infeasible"
          ? "No-go: modeled constraints cannot be satisfied"
          : "Solver stopped without a feasible proposal"}
      </h3>
      {bottlenecks?.length ? (
        <ul className="space-y-1">
          {bottlenecks.map((p, i) => (
            <li key={i}>
              H{String(p["hour"])}: demand {numberLabel(p["baseline_demand_kw"])} kW exceeds modeled
              maximum {numberLabel(p["maximum_instantaneous_supply_kw"])} kW · shortfall{" "}
              {numberLabel(p["shortfall_kw"])} kW.
            </li>
          ))}
        </ul>
      ) : null}
      {blocked?.length ? (
        <p>
          Mission windows without eligible starts:{" "}
          {blocked.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join("; ")}
        </p>
      ) : null}
      <p className="text-muted-foreground">
        {String(
          diagnostics["note"] ??
            "Targeted checks, not a minimal conflict proof. Inspect the case assumptions and restrictions.",
        )}{" "}
        The previously selected plan remains unchanged.
      </p>
    </div>
  );
}

export function PlanningEvidence({
  plan,
  run,
  missionId,
}: {
  plan: PlanVersion;
  run: SimulationRun | null;
  missionId?: string | undefined;
}) {
  const context = plan.plan_snapshot["planning_context"] as Record<string, unknown> | undefined;
  const config = context?.["config_snapshot"] as SimulationRun["config_snapshot"] | undefined;
  const station = config?.station ?? run?.config_snapshot.station;
  const mission = station?.missions.find((m) => m.id === missionId);
  const assessment = plan.plan_snapshot["uncertainty_assessment"] as
    Record<string, unknown> | undefined;
  return (
    <section className="mt-3 rounded border border-border bg-secondary/15 p-4 text-xs">
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-semibold">
          Planning policy: {String(context?.["mode"] ?? "legacy saved case")}
        </h3>
        <span className="text-muted-foreground">Shared horizon: H0–H{plan.days * 24 - 1}</span>
      </div>
      {assessment && (
        <details className="mt-2">
          <summary className="cursor-pointer text-primary">Weather-envelope assumptions</summary>
          <p className="mt-2 text-muted-foreground">
            {String(
              assessment["method"] ?? "Uses one weather trajectory from the selected policy.",
            )}
          </p>
          <p className="mt-2 text-muted-foreground">
            Cases:{" "}
            {Array.isArray(assessment["scenario_names"]) && assessment["scenario_names"].length
              ? assessment["scenario_names"].join(", ")
              : "single trajectory"}
            . No calibrated probability. Replay illustration:{" "}
            {String(assessment["replay_scenario"] ?? "selected weather")}; not simultaneous
            execution of all alternatives.
          </p>
        </details>
      )}
      {mission && (
        <div className="mt-3">
          <h4 className="font-semibold">{mission.name} · resource & weather restrictions</h4>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              Power:{" "}
              <strong>
                {mission.power_kw} kW × {mission.duration_hours} h
              </strong>
            </div>
            <div>
              Priority:{" "}
              <strong>
                {["Critical", "High", "Medium", "Low"][mission.priority] ?? "Unavailable"}
              </strong>
            </div>
            <div>
              Nominal start: <strong>H{mission.start_hour}</strong> · flexibility ±
              {String(context?.["flexibility_hours"] ?? "—")} h
            </div>
            <div>
              Weather: visibility ≥{" "}
              <strong>{mission.minimum_visibility_km ?? "unavailable"} km</strong>, wind ≤{" "}
              <strong>{mission.maximum_wind_kmh ?? "unavailable"} km/h</strong>
            </div>
            <div>
              Equipment: <strong>{mission.equipment?.join(", ") || "none required"}</strong>
            </div>
            <div>
              Personnel: <strong>{mission.personnel?.join(", ") || "none required"}</strong>
            </div>
          </dl>
          <p className="mt-2 text-muted-foreground">
            Shared resources cannot overlap. Weather and timing eligibility are evaluated with
            energy and reserve constraints. No precedence relationship is inferred from mission
            names.
          </p>
        </div>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-primary">Configuration identity</summary>
        <p className="mt-2 break-all text-muted-foreground">
          {String(context?.["config_fingerprint"] ?? "Unavailable for legacy version")}
        </p>
      </details>
    </section>
  );
}
