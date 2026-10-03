import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./shell";
import { ResourceCharts, ResourceTable } from "./resource-charts";
import { useOperatingWorkspace } from "@/lib/use-operating-workspace";
import { numberLabel, resourceMetrics, nextDecision } from "@/lib/operations-metrics";

export function OperationsDashboard() {
  const ws = useOperatingWorkspace();
  const [view, setView] = useState<"auto" | "projected" | "observed">("auto");
  const [full, setFull] = useState(false);
  if (ws.loading)
    return (
      <p role="status" className="panel p-5">
        Loading operations…
      </p>
    );
  if (ws.error)
    return (
      <div role="alert" className="panel p-5">
        {ws.error}
        <Button className="ml-3" onClick={ws.refresh}>
          Retry
        </Button>
      </div>
    );
  if (!ws.run || !ws.cursor.point)
    return (
      <section className="panel p-6">
        <h1 className="text-xl font-bold">Operations</h1>
        <p className="my-4 text-muted-foreground">
          Select an operating case to inspect station resources and decisions.
        </p>
        <Button asChild>
          <Link to="/scenario-simulator">
            Open operating cases <ArrowRight size={15} />
          </Link>
        </Button>
      </section>
    );
  const { run, plan, activePlan, cursor, session } = ws;
  const point = cursor.point!;
  const hour = point.hour;
  const metrics = resourceMetrics(run, point);
  const station = run.config_snapshot.station;
  const matchingActive = activePlan?.source_simulation_run_id === run.id;
  const history = cursor.observed ? ws.points.filter((p) => p.hour <= hour) : [];
  const displayedView = view === "auto" ? (history.length >= 2 ? "observed" : "projected") : view;
  const points =
    displayedView === "observed"
      ? history
      : ws.points.filter((p) => p.hour >= hour && (full || p.hour < hour + 48));
  const operatingPlan = matchingActive ? activePlan : plan;
  const origin = Number(
    (
      operatingPlan?.plan_snapshot["monitoring_replan"] as
        { absolute_origin_hour?: number } | undefined
    )?.absolute_origin_hour ?? 0,
  );
  const schedule = (operatingPlan?.plan_snapshot.schedule ?? []).map((m) => ({
    ...m,
    start_hour: m.start_hour == null ? null : m.start_hour + origin,
  }));
  const upcoming = schedule
    .filter((m) => m.selected && Number(m.start_hour) + Number(m.duration_hours) > hour)
    .sort((a, b) => Number(a.start_hour) - Number(b.start_hour));
  const recorded = session?.events ?? [];
  const progress = session?.latest_observation?.mission_progress;
  const observedCompleted = progress
    ? progress.filter((m) => m["observed_state"] === "mission_completed").length
    : null;
  const decision = nextDecision(plan, session?.pending_proposal_id);
  const alerts = session?.active_alerts ?? [];
  const generator = point.generator_output_kw
    ? Object.values(point.generator_output_kw).reduce((sum, value) => sum + value, 0)
    : null;
  const tiles = [
    [
      "Battery above reserve",
      `${numberLabel(metrics.margin)} kWh`,
      `Protected reserve ${station.battery.reserve_kwh} kWh`,
    ],
    [
      "Fuel runway",
      metrics.runway === null ? "Not available" : `${numberLabel(metrics.runway / 24)} days`,
      "Recent modeled fuel rate (≤24h)",
    ],
    [
      "Next resupply",
      metrics.resupply === null
        ? "Not scheduled"
        : metrics.resupply === 0
          ? "Arrival reached"
          : `${numberLabel(metrics.resupply / 24)} days`,
      `${numberLabel(point.fuel_liters, 0)} L on hand`,
    ],
    [
      "Mission delivery",
      observedCompleted === null
        ? plan
          ? `${upcoming.length} planned`
          : "Not planned"
        : `${observedCompleted} completed`,
      observedCompleted === null
        ? "Remaining selected work / proposal"
        : `Observed through H${hour}`,
    ],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="micro-label text-primary">Station command</p>
          <h1 className="text-2xl font-bold">Operations</h1>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">{cursor.label}</span>
          <Button asChild size="sm" variant="outline">
            <Link to="/forecast">
              Look ahead <ArrowRight size={14} />
            </Link>
          </Button>
        </div>
      </div>
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${metrics.critical === false ? "border-destructive/40 bg-destructive/5" : "border-success/25 bg-success/5"}`}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck size={17} />
          Critical service:{" "}
          {metrics.critical === null ? "unavailable" : metrics.critical ? "served" : "shortfall"}
        </span>
        <span className="text-xs text-muted-foreground">
          Active plan:{" "}
          {ws.activeError
            ? "unavailable"
            : activePlan
              ? `v${activePlan.version_number}${matchingActive ? " · this case" : " · another case"}`
              : "none"}{" "}
          · Selected: {plan ? `v${plan.version_number} / ${plan.status}` : "none"}
        </span>
      </div>
      <section
        className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
        aria-label="Current station posture"
      >
        <p>
          <strong>Power now</strong> · {numberLabel(point.served_kw)} /{" "}
          {numberLabel(point.demand_kw)} kW demand served · {numberLabel(point.renewable_kw)} kW
          renewable · {numberLabel(generator)} kW generators
        </p>
        <p className={alerts.length ? "text-warning" : "text-muted-foreground"}>
          {alerts.length
            ? `${alerts.length} active condition(s): ${alerts.map((a) => a.rule.replaceAll("_", " ")).join(", ")}`
            : !session
              ? "Monitoring not started"
              : session.active_alerts === undefined
                ? "Current alert state unavailable"
                : "No active monitoring alerts"}
        </p>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(([label, value, note]) => (
          <div key={label} className="panel px-4 py-3">
            <h2 className="text-xs text-muted-foreground">{label}</h2>
            <div className="my-1 text-xl font-bold tabular-nums">{value}</div>
            <p className="text-xs text-muted-foreground">{note}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(260px,1fr)]">
        <section className="panel min-w-0 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Resource trajectory</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={displayedView === "projected" ? "default" : "outline"}
                onClick={() => setView("projected")}
              >
                Projected case
              </Button>
              <Button
                size="sm"
                variant={displayedView === "observed" ? "default" : "outline"}
                onClick={() => setView("observed")}
              >
                Observed history
              </Button>
              <button
                className="px-2 text-xs text-primary underline"
                onClick={() => setFull(!full)}
              >
                {full ? "Next 48h" : "Full horizon"}
              </button>
            </div>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            {displayedView === "projected"
              ? `${session?.execution_policy === "generator_first_approved_missions_v1" ? "Approved mission continuation" : "Saved case replay"} · H${hour}–H${points.at(-1)?.hour ?? hour}; simulator dispatch, not a live forecast.`
              : cursor.observed
                ? `Observed playback only · through H${hour}.`
                : "Playback has not started; no observed history yet."}
          </p>
          <ResourceCharts
            points={points}
            reserve={station.battery.reserve_kwh}
            arrival={point.resupply_arrival_hour}
            compact
          />
          <ResourceTable points={points} />
        </section>
        <aside className="min-w-0 space-y-3">
          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Next decision</h2>
              <StatusBadge tone={session?.pending_proposal_id ? "warn" : "neutral"}>
                {session?.pending_proposal_id ? "1 pending" : "Operator"}
              </StatusBadge>
            </div>
            <p className="mb-3 text-sm">{decision.label}</p>
            {session?.pending_proposal_id && (
              <p className="mb-3 text-xs text-warning">
                Operator approval required. The current plan stays active until explicit replacement
                activation.
              </p>
            )}
            <Button asChild size="sm" className="w-full">
              <Link to={decision.route}>
                Open workspace <ArrowRight size={14} />
              </Link>
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              {recorded.length} recorded monitoring event(s)
              {session ? ` · through H${session.current_hour}` : " · session not started"}
            </p>
            {recorded.at(-1) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Last recorded change: H{recorded.at(-1)!.hour} ·{" "}
                {recorded.at(-1)!.rule.replaceAll("_", " ")}
              </p>
            )}
          </section>
          <section className="panel p-4">
            <h2 className="mb-3 text-sm font-semibold">Mission windows</h2>
            {upcoming.length ? (
              upcoming.slice(0, 4).map((m) => (
                <Link to="/mission-planner" key={m.mission_id} className="mb-3 block text-xs">
                  <span className="flex justify-between gap-2">
                    <span className="truncate font-medium">
                      {station.missions.find((x) => x.id === m.mission_id)?.name ?? m.mission_id}
                    </span>
                    <span className="shrink-0 text-muted-foreground">H{m.start_hour}</span>
                  </span>
                  <span className="mt-2 block h-2 overflow-hidden rounded bg-secondary">
                    <span
                      className="block h-2 rounded bg-primary"
                      style={{
                        marginLeft: `${(Number(m.start_hour) / (run.duration_days * 24)) * 100}%`,
                        width: `${Math.max(2, (Number(m.duration_hours) / (run.duration_days * 24)) * 100)}%`,
                      }}
                    />
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                {plan
                  ? "No remaining selected work."
                  : "Generate a proposal to inspect mission windows."}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {operatingPlan
                ? `Plan H${origin}–H${run.duration_days * 24 - 1} · ${run.duration_days * 24 - origin}h`
                : `Case horizon · ${run.duration_days * 24}h`}
            </p>
          </section>
          <details className="panel p-4 text-xs">
            <summary className="cursor-pointer font-semibold">Assets & weather</summary>
            <div className="mt-3 space-y-2 text-muted-foreground">
              <p>
                {point.weather_regime ?? "Weather regime unavailable"} · visibility{" "}
                {numberLabel(point.visibility_km)} km
              </p>
              {station.generators.map((g) => (
                <p key={g.id}>
                  {g.name}: {point.generator_status?.[g.id] ?? "status unavailable"} ·{" "}
                  {numberLabel(point.generator_output_kw?.[g.id])} / {g.capacity_kw} kW
                </p>
              ))}
              <Link className="block text-primary underline" to="/energy-assets">
                Open asset details
              </Link>
            </div>
          </details>
        </aside>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-semibold">
          Case details & full-horizon results
        </summary>
        <p className="mt-2">
          {run.scenario.replaceAll("_", " ")} · {run.duration_days} days · seed {run.seed}.
          End-of-run: {run.summary.missions_completed} missions completed;{" "}
          {run.summary.critical_violation_hours} critical shortfall hours;{" "}
          {numberLabel(run.summary.fuel_remaining_liters)} L fuel. These totals are not the current
          operating state.
        </p>
        <p className="mt-2 break-all">
          Case {run.id} · station model {run.simulator_version}
        </p>
      </details>
    </div>
  );
}
