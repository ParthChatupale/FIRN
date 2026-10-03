import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, BrainCircuit, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, ReasonButton, SectionTitle, StatusBadge } from "@/components/firn/shell";
import { useFirn } from "@/lib/firn-context";
import { formatRecordTime } from "@/lib/workspace-model";
import { normalLog, stormLog } from "@/lib/firn-data";
import {
  getMonitoringSession,
  getPlan,
  getSimulationEvents,
  getSimulationRun,
  type MonitoringSession,
  type PlanVersion,
  type SimulationRun,
} from "@/lib/firn-api";
export const Route = createFileRoute("/decision-log")({
  head: () => ({
    meta: [
      { title: "Decision Log — FIRN" },
      {
        name: "description",
        content:
          "Explainable simulated decisions and adaptive replanning history for polar station operations.",
      },
      { property: "og:title", content: "Decision Log — FIRN" },
      {
        property: "og:description",
        content: "Trace the decisions behind FIRN’s simulated adaptive operating plan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DecisionLog,
});
export function IllustrativeDecisionLog() {
  const { scenario, scenarioId } = useFirn();
  const entries =
    scenarioId === "normal"
      ? normalLog
      : scenarioId === "storm"
        ? stormLog
        : [
            {
              time: "08:08",
              event: scenario.headline,
              action: scenario.impact,
              reason: scenario.message,
            },
            ...stormLog.slice(2),
          ];
  return (
    <>
      <PageHeader
        eyebrow="Explainable Decisions / Audit trail"
        title="Decision Log"
        description="Trace the chain of simulated observations, risk assessments and operating decisions."
        action={<ReasonButton children="Explain Latest Decision" />}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <div className="panel p-5 md:p-7">
          <SectionTitle aside="Most recent first">Operational decision chain</SectionTitle>
          <div className="relative mt-6">
            {entries.map((entry, i) => (
              <div
                key={i}
                className="relative grid grid-cols-[50px_22px_1fr] gap-3 pb-7 last:pb-0 sm:grid-cols-[70px_26px_1fr]"
              >
                <div className="pt-0.5 font-display text-xs font-bold text-primary">
                  {entry.time}
                </div>
                <div className="relative flex justify-center">
                  <span
                    className={`relative z-10 mt-1 size-2 rounded-full ${i === 0 ? "bg-primary" : "bg-muted-foreground"}`}
                  />
                  {i < entries.length - 1 && (
                    <span className="absolute top-3 bottom-[-25px] w-px bg-border" />
                  )}
                </div>
                <div className="min-w-0 rounded border border-border bg-secondary/25 p-4 transition-colors hover:border-primary/35">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{entry.event}</h3>
                    {i === 0 && <StatusBadge tone="good">LATEST</StatusBadge>}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-primary">
                    <ArrowRight size={14} />
                    {entry.action}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{entry.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <div className="panel p-5">
            <BrainCircuit size={21} className="text-primary" />
            <div className="micro-label mt-4 text-primary">Decision pipeline</div>
            <div className="mt-4 space-y-3">
              {["SENSE", "PREDICT", "OPTIMIZE", "ADAPT", "EXPLAIN"].map((step, i) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="flex size-6 items-center justify-center rounded border border-primary/30 bg-primary/10 text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-xs font-semibold tracking-[.12em]">{step}</span>
                  {i < 4 && <ArrowDown size={12} className="ml-auto text-muted-foreground" />}
                </div>
              ))}
            </div>
          </div>
          <div className="panel border-primary/30 bg-primary/5 p-5">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Clock3 size={16} className="text-primary" /> Simulation history
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Events reflect the selected demonstration scenario. No live station infrastructure is
              connected.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function DecisionLog() {
  const { runId, planId, monitoringId, workflowLoaded } = useFirn();
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
        eyebrow="Persisted actions / Audit trail"
        title="Decision Log"
        description="Trace saved simulation events and operator actions on their respective clocks, including the selected plan’s ancestry."
        action={
          <Button variant="outline" onClick={() => setRevision((value) => value + 1)}>
            Refresh history
          </Button>
        }
      />
      <DecisionHistory
        key={JSON.stringify([runId, planId, monitoringId, revision])}
        runId={runId}
        planId={planId}
        monitoringId={monitoringId}
      />
    </>
  );
}

type HistoryRow = {
  key: string;
  time: string;
  order: number | null;
  title: string;
  action: string;
  detail: string;
};

// Backend ISO timestamps without an offset use UTC, just like offset-aware records.
function recordedTime(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const parsed = Date.parse(/[zZ]$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function DecisionHistory({
  runId,
  planId,
  monitoringId,
}: {
  runId: string | null;
  planId: string | null;
  monitoringId: string | null;
}) {
  const { preferences } = useFirn();
  const [run, setRun] = useState<SimulationRun | null>(null);
  const [plan, setPlan] = useState<PlanVersion | null>(null);
  const [lineage, setLineage] = useState<PlanVersion[]>([]);
  const [session, setSession] = useState<MonitoringSession | null>(null);
  const [runEvents, setRunEvents] = useState<Array<Record<string, unknown>>>([]);
  const [eventFilter, setEventFilter] = useState("all");
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
      async function loadLineage() {
        const versions: PlanVersion[] = [];
        let version = savedPlan;
        while (version && !cancelled) {
          if (versions.some((item) => item.id === version?.id))
            throw new Error("The saved plan lineage contains a cycle.");
          versions.push(version);
          version = version.parent_version_id ? await getPlan(version.parent_version_id) : null;
        }
        return versions.reverse();
      }
      const [savedRun, events, versions] = await Promise.all([
        selectedRunId ? getSimulationRun(selectedRunId) : Promise.resolve(null),
        selectedRunId ? getSimulationEvents(selectedRunId) : Promise.resolve([]),
        loadLineage(),
      ]);
      if (!cancelled) {
        setRun(savedRun);
        setRunEvents(savedSession?.observed_events ?? events);
        setPlan(savedPlan);
        setLineage(versions);
        setSession(savedSession);
        setLoading(false);
      }
    }
    void load().catch((reason) => {
      if (!cancelled) {
        setError(
          reason instanceof Error ? reason.message : "Could not load persisted decision history.",
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
        Loading persisted history and plan lineage…
      </div>
    );
  if (error)
    return (
      <div role="alert" className="panel p-5 text-sm text-destructive">
        {error} Use Refresh history to retry.
      </div>
    );
  const auditRows: HistoryRow[] = [];
  const simulatedRows: HistoryRow[] = [];
  const wallTime = (value: string | undefined) => {
    const timestamp = recordedTime(value);
    return timestamp === null
      ? "Recording time unavailable"
      : formatRecordTime(value, preferences.timezone);
  };
  if (run)
    auditRows.push({
      key: `run-${run.id}`,
      time: wallTime(run.created_at),
      order: recordedTime(run.created_at),
      title: "Simulation run persisted",
      action: `${run.scenario.replaceAll("_", " ")} · ${run.duration_days} days · seed ${run.seed}`,
      detail: `${run.summary.duration_hours} hourly observations saved.`,
    });
  const start = recordedTime(run?.config_snapshot.start_time ?? run?.started_at);
  runEvents.forEach((event, index) => {
    const timestamp = recordedTime(event["timestamp"]);
    const hour =
      typeof event["hour"] === "number" && Number.isFinite(event["hour"])
        ? event["hour"]
        : start !== null && timestamp !== null
          ? Math.round((timestamp - start) / 3600000)
          : null;
    // A precomputed future event is not an observation at the monitoring cursor.
    if (session && (hour === null || hour > session.current_hour || session.current_hour < 0))
      return;
    simulatedRows.push({
      key: `event-${index}`,
      time: hour === null ? "Simulated hour unavailable" : `Simulated hour ${hour}`,
      order: hour,
      title: String(event["kind"] ?? "Simulation event").replaceAll("_", " "),
      action: String(event["subject"] ?? "Station state"),
      detail:
        event["kind"] === "storm"
          ? "Storm conditions recorded. Current weather and active alerts are available in Monitoring."
          : String(event["message"] ?? "Persisted event from the simulation run."),
    });
  });
  lineage.forEach((version) =>
    version.history.forEach((event, index) =>
      auditRows.push({
        key: `plan-${version.id}-${index}`,
        time: wallTime(event.created_at),
        order: recordedTime(event.created_at),
        title: `Plan v${version.version_number} · ${event.action.replaceAll("_", " ")}`,
        action: `${event.from_status ?? "—"} → ${event.to_status ?? "—"}`,
        detail: `${event.actor ?? "system"}${event.note ? ` · ${event.note}` : ""}`,
      }),
    ),
  );
  session?.events
    .filter((event) => session.current_hour >= 0 && event.hour <= session.current_hour)
    .forEach((event) =>
      simulatedRows.push({
        key: event.id,
        time: `Simulated hour ${event.hour}`,
        order: event.hour,
        title: `Monitoring · ${event.rule.replaceAll("_", " ")}`,
        action: `${event.severity} · ${event.action}`,
        detail: event.proposal_plan_version_id
          ? `Linked plan ${event.proposal_plan_version_id.slice(0, 8)} · ${event.action === "execution_resumed" ? "Operator activation carried the checkpoint state into continued mission execution." : "Replacement decision recorded; inspect monitoring for its trigger and consequences."}`
          : "Recorded against the selected monitoring session.",
      }),
    );
  const newestFirst = (a: HistoryRow, b: HistoryRow) =>
    a.order === null ? (b.order === null ? 0 : 1) : b.order === null ? -1 : b.order - a.order;
  auditRows.sort(newestFirst);
  simulatedRows.sort(newestFirst);

  return (
    <>
      {plan && (
        <div className="panel mb-5 p-5">
          <SectionTitle>Plan lineage · selected version and ancestors</SectionTitle>
          <details className="mb-4 break-all text-xs text-muted-foreground">
            <summary className="cursor-pointer">Record identifiers</summary>
            <p className="mt-2">
              Group {plan.plan_group_id} · selected plan {plan.id}
            </p>
          </details>
          <ol className="space-y-3">
            {lineage.map((version) => (
              <li key={version.id} className="rounded border border-border p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    Version {version.version_number}
                    {version.id === plan.id ? " · selected" : ""}
                  </span>
                  <StatusBadge tone={version.status === "active" ? "good" : "neutral"}>
                    {version.status}
                  </StatusBadge>
                </div>
                <details className="mt-2 break-all">
                  <summary className="cursor-pointer text-muted-foreground">
                    Version record details
                  </summary>
                  <p className="mt-2">Plan {version.id}</p>
                  <p className="mt-1 break-all text-muted-foreground">
                    Parent: {version.parent_version_id ?? "Root proposal"} · Source run:{" "}
                    {version.source_simulation_run_id ?? "No linked run"}
                  </p>
                  {version.simulation_start_time && (
                    <p className="mt-1 text-muted-foreground">
                      Plan operating start:{" "}
                      {formatRecordTime(version.simulation_start_time, preferences.timezone)}
                    </p>
                  )}
                </details>
              </li>
            ))}
          </ol>
        </div>
      )}
      {session && (
        <div className="panel mb-5 space-y-2 p-4 text-xs">
          <p>
            {session.current_hour < 0
              ? "Monitoring has not observed the first simulated hour."
              : `Monitoring cursor: simulated hour ${session.current_hour}. Future run events are hidden.`}
          </p>
          <details className="break-all text-muted-foreground">
            <summary className="cursor-pointer">Monitoring record details</summary>
            <p className="mt-2">
              Session {session.id} · monitored plan {session.plan_version_id} · run{" "}
              {session.simulation_run_id}
            </p>
            {session.pending_proposal_id && (
              <p className="break-all">Pending proposal: {session.pending_proposal_id}</p>
            )}
          </details>
        </div>
      )}
      {!runId && !planId && !monitoringId && (
        <div className="panel mb-5 p-6">
          <SectionTitle>No persisted workflow history yet</SectionTitle>
          <p className="mb-4 text-sm text-muted-foreground">
            Create a seeded scenario run, then generate and review its linked plan. The resulting
            lifecycle and monitoring events will appear here.
          </p>
          <Button asChild>
            <Link to="/scenario-simulator">
              Start with a scenario run <ArrowRight size={14} />
            </Link>
          </Button>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <label className="flex flex-wrap items-center gap-3 text-sm">
            Event source
            <select
              aria-label="Event source"
              value={eventFilter}
              onChange={(event) => setEventFilter(event.target.value)}
              className="rounded border border-border bg-background px-3 py-2"
            >
              <option value="all">All records</option>
              <option value="monitoring">Monitoring decisions</option>
              <option value="station">Station events</option>
              <option value="operator">Operator actions</option>
            </select>
          </label>
          {[
            {
              title: "Station events & monitoring decisions",
              aside: session
                ? "Observed through the monitoring cursor · newest hour first"
                : "Full saved run · newest hour first",
              rows: simulatedRows.filter(
                (row) =>
                  eventFilter === "all" ||
                  (eventFilter === "station" && row.key.startsWith("event-")) ||
                  (eventFilter === "monitoring" && row.title.startsWith("Monitoring ·")),
              ),
            },
            {
              title: "Recorded operator and persistence actions",
              aside: `Recorded wall clock · ${preferences.timezone === "UTC" ? "UTC" : "IST"} · newest first`,
              rows: eventFilter === "all" || eventFilter === "operator" ? auditRows : [],
            },
          ].map(({ title, aside, rows }) => (
            <section key={title} className="panel p-5 md:p-7">
              <SectionTitle aside={aside}>{title}</SectionTitle>
              {rows.length === 0 ? (
                <p className="py-8 text-sm text-muted-foreground">
                  {eventFilter === "all"
                    ? "No events are available for this timeline."
                    : "No records match the selected source in this timeline."}
                </p>
              ) : (
                <div className="relative mt-6">
                  {rows.map((entry, index) => (
                    <div
                      key={entry.key}
                      className="relative grid grid-cols-[22px_1fr] gap-3 pb-5 last:pb-0"
                    >
                      <div className="relative flex justify-center">
                        <span
                          className={`relative z-10 mt-1 size-2 rounded-full ${index === 0 ? "bg-primary" : "bg-muted-foreground"}`}
                        />
                        {index < rows.length - 1 && (
                          <span className="absolute top-3 bottom-[-18px] w-px bg-border" />
                        )}
                      </div>
                      <div className="min-w-0 rounded border border-border bg-secondary/25 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold">{entry.title}</h3>
                          <span className="text-[10px] text-muted-foreground">{entry.time}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-primary">
                          <ArrowRight size={14} />
                          {entry.action}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {entry.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
        <details className="panel h-fit p-5 text-xs">
          <summary className="cursor-pointer font-semibold">Timeline methodology</summary>
          <div className="mt-4">
            <BrainCircuit size={21} className="text-primary" />
            <div className="micro-label mt-4 text-primary">Decision workflow</div>
            <div className="mt-4 space-y-3">
              {["SIMULATE", "OPTIMIZE", "EXPLAIN", "OPERATOR REVIEW", "MONITOR + REPLAN"].map(
                (step, index) => (
                  <div key={step} className="flex items-center gap-3">
                    <span className="flex size-6 items-center justify-center rounded border border-primary/30 bg-primary/10 text-[10px] font-bold text-primary">
                      {index + 1}
                    </span>
                    <span className="text-xs font-semibold tracking-[.08em]">{step}</span>
                    {index < 4 && <ArrowDown size={12} className="ml-auto text-muted-foreground" />}
                  </div>
                ),
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Clock3 size={16} className="text-primary" /> Simulation evidence
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Simulation and monitoring events are ordered by simulated hour. Operator and
              persistence actions use their recorded wall-clock timestamps in a separate timeline.
              Plan lineage connects decisions without equating these clocks. All station conditions
              are synthetic.
            </p>
          </div>
        </details>
      </div>
    </>
  );
}
