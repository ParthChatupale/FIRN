import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  BatteryCharging,
  CircleCheck,
  CloudSun,
  Droplets,
  Fuel,
  Gauge,
  ShieldCheck,
  Wind,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, ReasonButton, SectionTitle, StatusBadge } from "@/components/firn/shell";
import { RunTimeline } from "@/components/firn/run-timeline";
import { useFirn } from "@/lib/firn-context";
import { missionData } from "@/lib/firn-data";
import {
  getMonitoringSession,
  getPlan,
  getSimulationRun,
  getSimulationTelemetry,
  type MonitoringSession,
  type PlanVersion,
  type SimulationRun,
  type TelemetryPoint,
} from "@/lib/firn-api";
import stationImage from "@/assets/polar-station.jpg";
import { useOperatingWorkspace } from "@/lib/use-operating-workspace";
import { OperationsDashboard } from "@/components/firn/operations-dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Operations — FIRN" },
      {
        name: "description",
        content: "Inspect persisted synthetic station runs, joint plans, and operator decisions.",
      },
      { property: "og:title", content: "Station Overview — FIRN" },
      {
        property: "og:description",
        content: "Explore FIRN’s mission-aware and energy-aware operating workflow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OperationsDashboard,
});
export function IllustrativeOverview() {
  const { scenario, scenarioId } = useFirn();
  const kpis = [
    {
      label: "Renewable Generation",
      value: `${scenario.solar + scenario.windPower} kW`,
      sub: "Expected available",
      icon: Zap,
      hint: scenarioId === "normal" ? "+ 6% forecast" : "Forecast adjusted",
    },
    {
      label: "Battery State",
      value: `${scenario.battery}%`,
      sub: scenarioId === "battery" ? "153 kWh usable" : "218 kWh usable",
      icon: BatteryCharging,
      hint: scenarioId === "normal" ? "Reserve healthy" : "Reserve protected",
    },
    {
      label: "Fuel Reserve",
      value: scenario.fuel,
      sub: scenarioId === "fuel" ? "Resupply delayed 5 days" : "12-day estimated runway",
      icon: Fuel,
      hint: "Fuel-Aware Planning",
    },
    {
      label: "Current Demand",
      value: "52 kW",
      sub: "Station load",
      icon: Gauge,
      hint: "Critical loads protected",
    },
    {
      label: "Mission Status",
      value: scenarioId === "normal" ? "4 / 5" : "3 / 5",
      sub: "Missions on plan",
      icon: Activity,
      hint: scenarioId === "normal" ? "On schedule" : "Plan adapted",
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Station / Operations"
        title="Station Overview"
        description="Mission, energy and operational intelligence"
        action={
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.1em] text-success">
            <span className="size-2 rounded-full bg-success dot-pulse" /> FIRN ENGINE ONLINE
          </div>
        }
      />
      <div className="relative mb-5 min-h-[170px] overflow-hidden rounded-md border border-border bg-surface md:min-h-[190px]">
        <img
          src={stationImage}
          width={1536}
          height={768}
          alt="Simulated polar research station in a snowy landscape"
          className="absolute inset-0 h-full w-full object-cover object-[center_58%] opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="relative flex h-full min-h-[170px] flex-col justify-center px-6 py-6 md:min-h-[190px] md:px-8">
          <div
            className={`micro-label flex items-center gap-2 ${scenarioId === "normal" ? "text-success" : "text-warning"}`}
          >
            <span
              className={`size-2 rounded-full ${scenarioId === "normal" ? "bg-success" : "bg-warning dot-pulse"}`}
            />
            {scenario.headline}
          </div>
          <h2 className="mt-3 max-w-[580px] font-display text-xl font-bold md:text-2xl">
            {scenarioId === "normal" ? "The station is operating on plan." : scenario.impact}
          </h2>
          <p className="mt-2 max-w-[620px] text-xs leading-5 text-foreground/80 md:text-sm">
            {scenario.message}
          </p>
          <Link
            to="/scenario-simulator"
            className="mt-4 inline-flex w-fit items-center gap-2 text-xs font-semibold text-primary hover:underline"
          >
            Explore scenarios <ArrowRight size={14} />
          </Link>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map(({ label, value, sub, icon: Icon, hint }) => (
          <div
            key={label}
            className="panel min-w-0 p-4 transition-colors hover:border-primary/40 md:p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="micro-label leading-4">{label}</div>
              <Icon size={18} className="shrink-0 text-primary" strokeWidth={1.7} />
            </div>
            <div className="mt-4 font-display text-[26px] font-bold leading-none md:text-[30px]">
              {value}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
            <div className="mt-4 border-t border-border pt-3 text-[10px] text-success">
              ● <span className="ml-1 text-muted-foreground">{hint}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.14fr_.86fr]">
        <div className="space-y-5">
          <EnergyFlow solar={scenario.solar} wind={scenario.windPower} battery={scenario.battery} />
          <div className="panel p-5 md:p-6">
            <SectionTitle
              aside={
                <Link
                  to="/mission-planner"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  Open planner <ArrowRight size={13} />
                </Link>
              }
            >
              Mission Operations
            </SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[590px] text-left text-xs">
                <thead className="border-b border-border text-[10px] uppercase tracking-[.12em] text-muted-foreground">
                  <tr>
                    {["Mission", "Power", "Duration", "Priority", "Status"].map((h) => (
                      <th key={h} className="pb-3 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {missionData.map((m) => {
                    const status =
                      scenarioId !== "normal" && m.name === "Experiment B"
                        ? "DEFERRED"
                        : scenarioId === "generator" && m.name === "Atmospheric Observation"
                          ? "RESCHEDULED"
                          : m.status;
                    return (
                      <tr key={m.name} className="border-b border-border/60 last:border-0">
                        <td className="py-3.5 font-semibold">{m.name}</td>
                        <td className="text-muted-foreground">{m.power}</td>
                        <td className="text-muted-foreground">{m.duration}</td>
                        <td>
                          <span
                            className={
                              m.priority === "CRITICAL" ? "text-warning" : "text-muted-foreground"
                            }
                          >
                            {m.priority}
                          </span>
                        </td>
                        <td>
                          <StatusBadge
                            tone={
                              status === "DEFERRED"
                                ? "warn"
                                : status === "PROTECTED"
                                  ? "good"
                                  : status === "RUNNING"
                                    ? "neutral"
                                    : "neutral"
                            }
                          >
                            {status}
                          </StatusBadge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="space-y-5">
          <div className="panel p-5 md:p-6">
            <SectionTitle aside={<CloudSun size={17} className="text-primary" />}>
              Environmental Conditions
            </SectionTitle>
            <div className="grid grid-cols-2 gap-4 border-b border-border pb-5">
              {[
                ["Temperature", scenario.temperature],
                ["Wind", scenario.wind],
                ["Visibility", scenario.visibility],
                ["Storm Risk", scenario.risk],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="micro-label">{label}</div>
                  <div
                    className={`mt-1.5 font-display text-xl font-bold ${label === "Storm Risk" ? (scenario.risk === "HIGH" ? "text-destructive" : "text-warning") : ""}`}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground">
                <span>Weather Risk</span>
                <span>{scenario.risk}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${scenario.risk === "HIGH" ? "w-[85%] bg-destructive" : "w-[48%] bg-warning"}`}
                />
              </div>
            </div>
            <div className="mt-5 rounded border border-warning/20 bg-warning/5 p-3">
              <div className="text-xs font-semibold text-warning">Forecast Alert</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Severe storm probability increases over the next 8 hours.
              </p>
              <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs text-primary">
                <Link to="/forecast">
                  View Forecast <ArrowRight size={13} />
                </Link>
              </Button>
            </div>
          </div>
          <div className="panel border-primary/30 bg-primary/5 p-5 md:p-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="micro-label text-primary">
                  Joint Optimization / Decision support
                </div>
                <h2 className="mt-2 font-display text-lg font-bold">
                  FIRN Operational Recommendation
                </h2>
              </div>
              <ShieldCheck size={22} className="text-primary" />
            </div>
            <div className="mt-5 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Current Plan:</span>
              <StatusBadge tone={scenarioId === "normal" ? "good" : "warn"}>
                {scenarioId === "normal" ? "STABLE" : "ADAPTED"}
              </StatusBadge>
            </div>
            <p className="mt-4 text-[13px] leading-6 text-foreground/90">
              {scenarioId === "normal"
                ? "FIRN recommends maintaining the current mission schedule while preserving battery reserve for the forecast weather deterioration."
                : scenario.message}
            </p>
            <div className="mt-5 space-y-2 border-t border-border pt-4">
              {[
                [
                  "MISSION",
                  scenarioId === "normal" ? "Experiment A → Continue" : "Experiment B → Deferred",
                ],
                ["ENERGY", "Prioritize renewable generation"],
                ["RESERVE", "Maintain battery reserve above 30%"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 text-xs">
                  <span className="micro-label">{label}</span>
                  <span className="text-right">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <ReasonButton />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 border-t border-border pt-6">
        <SectionTitle>Why FIRN?</SectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Mission-Aware", "Understands what the station needs to accomplish.", CompassIcon],
            [
              "Asset-Aware",
              "Plans using the energy infrastructure that is actually available.",
              CircleCheck,
            ],
            ["Joint Optimization", "Schedules missions and allocates energy together.", Zap],
          ].map(([title, desc, Icon]) => {
            const IconComponent = Icon as typeof Zap;
            return (
              <div key={title as string} className="panel p-5">
                <IconComponent size={19} className="text-primary" />
                <h3 className="mt-4 text-xs font-bold uppercase tracking-[.1em]">
                  {title as string}
                </h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{desc as string}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          FIRN does not only ask how to supply energy. It determines what the station can safely
          accomplish, when it should happen, and how available resources should be used.
        </p>
      </div>
    </>
  );
}

export function ProductOverview() {
  const { runId, planId, monitoringId, workflowLoaded, refreshWorkflow } = useFirn();
  const [revision, setRevision] = useState(0);
  if (!workflowLoaded)
    return (
      <div role="status" className="panel p-5">
        Restoring selected workflow…
      </div>
    );
  return (
    <>
      <PageHeader
        eyebrow="Station / Operator workspace"
        title="Station Overview"
        description="Station resources, mission readiness and the selected operating plan."
        action={
          <Button
            variant="outline"
            onClick={() => {
              setRevision((value) => value + 1);
              refreshWorkflow();
            }}
          >
            Refresh overview
          </Button>
        }
      />
      <OverviewState
        key={JSON.stringify([runId, planId, monitoringId, revision])}
        runId={runId}
        planId={planId}
        monitoringId={monitoringId}
      />
    </>
  );
}

function OverviewState({
  runId,
  planId,
  monitoringId,
}: {
  runId: string | null;
  planId: string | null;
  monitoringId: string | null;
}) {
  const workspace = useOperatingWorkspace();
  const [run, setRun] = useState<SimulationRun | null>(null);
  const [points, setPoints] = useState<TelemetryPoint[]>([]);
  const [plan, setPlan] = useState<PlanVersion | null>(null);
  const [session, setSession] = useState<MonitoringSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const savedSession = monitoringId ? await getMonitoringSession(monitoringId) : null;
      if (savedSession && runId && savedSession.simulation_run_id !== runId)
        throw new Error(
          "The selected monitoring session belongs to a different run. Select a matching workflow in the planner.",
        );
      const selectedPlanId = planId ?? savedSession?.plan_version_id;
      const savedPlan = selectedPlanId ? await getPlan(selectedPlanId) : null;
      const selectedRunId =
        runId ?? savedSession?.simulation_run_id ?? savedPlan?.source_simulation_run_id;
      if (
        savedPlan?.source_simulation_run_id &&
        selectedRunId &&
        savedPlan.source_simulation_run_id !== selectedRunId
      )
        throw new Error(
          "The selected plan belongs to a different simulation run. Select a matching plan in the planner.",
        );
      const [savedRun, telemetry] = await Promise.all([
        selectedRunId ? getSimulationRun(selectedRunId) : Promise.resolve(null),
        selectedRunId ? getSimulationTelemetry(selectedRunId) : Promise.resolve(null),
      ]);
      if (!cancelled) {
        setRun(savedRun);
        setPoints(telemetry?.items ?? []);
        setPlan(savedPlan);
        setSession(savedSession);
        setLoading(false);
      }
    }
    void load().catch((reason) => {
      if (!cancelled) {
        setError(
          reason instanceof Error ? reason.message : "Could not load the selected FIRN workflow.",
        );
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [runId, planId, monitoringId]);
  if (loading)
    return (
      <div role="status" className="panel p-5 text-sm text-muted-foreground">
        Loading selected run, plan, and monitoring clock…
      </div>
    );
  if (error)
    return (
      <div role="alert" className="panel p-5 text-sm text-destructive">
        {error} Use Refresh overview to retry.
      </div>
    );
  const observedPoints = points
    .filter((point) => point.hour <= (workspace.cursor.hour ?? -1))
    .sort((a, b) => a.hour - b.hour);
  const latest = workspace.cursor.point;
  const measurement = workspace.cursor.label;
  const progress =
    session?.current_hour !== undefined && session.current_hour >= 0
      ? session.latest_observation?.mission_progress
      : undefined;
  const totalMissions = run?.mission_results.length ?? 0;
  const kpis = [
    {
      label: "Renewable output",
      value: latest ? `${latest.renewable_kw} kW` : "—",
      sub: latest
        ? `Solar ${latest.solar_kw ?? "—"} kW · wind ${latest.wind_kw ?? "—"} kW`
        : measurement,
      icon: Zap,
    },
    {
      label: "Battery state",
      value: latest ? `${latest.battery_soc_percent}%` : "—",
      sub: latest ? `${latest.battery_kwh} kWh stored` : measurement,
      icon: BatteryCharging,
    },
    {
      label: "Fuel inventory",
      value: latest ? `${latest.fuel_liters} L` : "—",
      sub: measurement,
      icon: Fuel,
    },
    {
      label: "Station demand",
      value: latest ? `${latest.demand_kw} kW` : "—",
      sub: latest ? `${latest.served_kw ?? "—"} kW served` : measurement,
      icon: Gauge,
    },
    {
      label: "Observed mission completion",
      value: session
        ? progress?.length
          ? `${progress.filter((item) => item["observed_state"] === "mission_completed").length} / ${progress.length}`
          : "—"
        : "—",
      sub: session ? measurement : "Monitoring not started",
      icon: Activity,
    },
  ];
  const schedule = plan?.plan_snapshot.schedule ?? [];
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge tone={run ? "good" : "neutral"}>{measurement}</StatusBadge>
        {run && <span className="text-xs text-muted-foreground">{run.station_name}</span>}
      </div>
      {!run && (
        <div className="relative mb-5 overflow-hidden rounded-md border border-border bg-surface">
          <img
            src={stationImage}
            width={1536}
            height={768}
            alt="Illustration of a polar research station"
            className="absolute inset-0 h-full w-full object-cover object-[center_58%] opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent" />
          <div className="relative flex flex-col justify-center px-6 py-5 md:px-8">
            <div className="micro-label text-primary">Operating workspace</div>
            <h2 className="mt-3 max-w-2xl font-display text-xl font-bold md:text-2xl">
              Select an operating case
            </h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-foreground/80 md:text-sm">
              Create or resume a saved case to load station readings and plans.
            </p>
            {!run && (
              <Button asChild className="mt-4 w-fit">
                <Link to="/scenario-simulator">
                  Start a scenario <ArrowRight size={14} />
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
      {run && !latest && (
        <div role="status" className="panel mb-5 p-4 text-sm text-muted-foreground">
          {session && session.current_hour < 0
            ? "Advance monitoring in the planner to observe the first simulated hour."
            : "No telemetry is available for the selected hour."}
        </div>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="panel min-w-0 p-4 md:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="micro-label leading-4">{label}</div>
              <Icon size={18} className="shrink-0 text-primary" strokeWidth={1.7} />
            </div>
            <div className="mt-4 font-display text-[26px] font-bold leading-none md:text-[30px]">
              {value}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>
      {run && observedPoints.length > 0 && (
        <div className="panel mb-5 p-5 md:p-6">
          <SectionTitle
            aside={
              <Link to="/forecast" className="flex items-center gap-1 text-primary hover:underline">
                Open resource view <ArrowRight size={13} />
              </Link>
            }
          >
            {session
              ? `Observed trajectory · through hour ${session.current_hour}`
              : "Prepared trajectory · H0"}
          </SectionTitle>
          <RunTimeline points={observedPoints} />
        </div>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <div className="panel p-5 md:p-6">
          <SectionTitle
            aside={
              <Link
                to="/mission-planner"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                Open workspace <ArrowRight size={13} />
              </Link>
            }
          >
            Plan lifecycle
          </SectionTitle>
          {plan ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-display text-lg font-bold">
                    Version {plan.version_number}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {plan.planner_model_version} · seed {plan.seed} ·{" "}
                    {plan.scenario.replaceAll("_", " ")}
                  </div>
                </div>
                <StatusBadge
                  tone={
                    plan.status === "active"
                      ? "good"
                      : plan.status === "rejected"
                        ? "critical"
                        : "warn"
                  }
                >
                  {plan.status.toUpperCase()}
                </StatusBadge>
              </div>
              <div className="mt-4 space-y-2">
                {schedule.slice(0, 5).map((item) => (
                  <div
                    key={item.mission_id}
                    className="flex items-center justify-between gap-3 border-t border-border pt-2 text-xs"
                  >
                    <span className="font-medium">{item.mission_id.replaceAll("-", " ")}</span>
                    <span className="text-right text-muted-foreground">
                      {item.selected
                        ? `hour ${item.start_hour} · ${item.duration_hours} h`
                        : (item.reason ?? "not selected")}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button asChild variant="outline">
                  <Link to="/mission-planner">
                    Review plan and operator actions <ArrowRight size={14} />
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-muted-foreground">
                {run
                  ? "No proposal is selected. Generate a joint mission-and-energy proposal from this run; it will stay pending until an operator acts."
                  : "No plan is selected. Create a simulation run to ground the optimizer in a repeatable case."}
              </p>
              <Button asChild className="mt-4" variant="outline">
                <Link to={run ? "/mission-planner" : "/scenario-simulator"}>
                  {run ? "Generate a joint proposal" : "Create a scenario"} <ArrowRight size={14} />
                </Link>
              </Button>
            </>
          )}
        </div>
        <div className="space-y-5">
          <details className="panel p-5 md:p-6">
            <summary className="cursor-pointer text-sm font-semibold">
              Case details & full-run results
            </summary>
            <div className="mt-4">
              <SectionTitle>Saved case · full-run summary</SectionTitle>
              {run ? (
                <div className="space-y-3">
                  <DetailRow label="Scenario" value={run.scenario.replaceAll("_", " ")} />
                  <DetailRow
                    label="Simulation horizon"
                    value={`${run.duration_days} days · ${run.summary.duration_hours} hours`}
                  />
                  <DetailRow label="Random seed" value={String(run.seed)} />
                  <DetailRow
                    label="Renewable share"
                    value={`${run.summary.renewable_share_percent}%`}
                  />
                  <DetailRow
                    label="Critical violations"
                    value={`${run.summary.critical_violation_hours} h · ${run.summary.unserved_energy_kwh} kWh unserved`}
                  />
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  No operational measurements are fabricated here. Run a case to populate the
                  workspace with saved model output.
                </p>
              )}
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 pb-2 text-xs last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
const CompassIcon = Droplets;
function EnergyFlow({ solar, wind, battery }: { solar: number; wind: number; battery: number }) {
  return (
    <div className="panel p-5 md:p-6">
      <SectionTitle aside="Live allocation model · simulated">Energy Flow</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {[
          [CloudSun, "SOLAR", `${solar} kW`],
          [Wind, "WIND", `${wind} kW`],
          [BatteryCharging, "BATTERY", battery < 70 ? "Reserve" : "12 kW"],
        ].map(([Icon, label, value]) => {
          const SourceIcon = Icon as typeof Zap;
          return (
            <div
              key={label as string}
              className="rounded border border-border bg-secondary/40 p-3 text-center"
            >
              <SourceIcon size={18} className="mx-auto text-primary" />
              <div className="micro-label mt-2">{label as string}</div>
              <div className="mt-1 font-display text-lg font-bold">{value as string}</div>
            </div>
          );
        })}
      </div>
      <div className="mx-auto h-6 w-px flow-line" />
      <div className="mx-auto max-w-[210px] rounded border border-primary/35 bg-primary/10 p-3 text-center">
        <div className="micro-label text-primary">Station Demand</div>
        <div className="mt-1 font-display text-2xl font-bold">52 kW</div>
      </div>
      <div className="mx-auto h-6 w-px flow-line" />
      <div className="mx-auto max-w-[130px] rounded border border-success/25 bg-success/5 px-3 py-2 text-center">
        <div className="micro-label text-success">Reserve</div>
        <div className="font-display text-lg font-bold">
          {solar + wind >= 52 ? solar + wind - 50 : "Protected"}
          {solar + wind >= 52 && " kW"}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-4 text-[11px]">
        {[
          ["Solar", "Available"],
          ["Wind", "Available"],
          ["Battery", battery < 70 ? "Reserve protected" : "Discharging"],
          ["Generator", "Standby"],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-success">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
