import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Play,
  Radio,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MonitoringComparison } from "@/components/firn/monitoring-comparison";
import { CheckpointEvidence } from "@/components/firn/checkpoint-evidence";
import { PageHeader, SectionTitle, StatusBadge } from "@/components/firn/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFirn } from "@/lib/firn-context";
import { formatTemperature, formatWind } from "@/lib/workspace-model";
import { decisionPending, missionState } from "@/lib/monitoring-model";
import {
  actOnPlan,
  advanceMonitoring,
  createMonitoringSession,
  getMonitoringSession,
  getPlan,
  getSimulationRun,
  getSimulationTelemetry,
  listPlans,
  type MonitoringSession,
  type PlanVersion,
  type SimulationRun,
  type TelemetryPoint,
} from "@/lib/firn-api";

export const Route = createFileRoute("/monitoring")({
  head: () => ({
    meta: [
      { title: "Station Monitoring — FIRN" },
      {
        name: "description",
        content:
          "Operator playback of saved simulated station observations against an approved plan.",
      },
    ],
  }),
  component: Monitoring,
});

function Monitoring() {
  const {
    runId,
    planId,
    monitoringId,
    setMonitoringId,
    setPlanId,
    workflowLoaded,
    refreshWorkflow,
    preferences,
    operator,
  } = useFirn();
  const [run, setRun] = useState<SimulationRun | null>(null);
  const [plan, setPlan] = useState<PlanVersion | null>(null);
  const [session, setSession] = useState<MonitoringSession | null>(null);
  const [points, setPoints] = useState<TelemetryPoint[]>([]);
  const [pending, setPending] = useState<PlanVersion | null>(null);
  const [hours, setHours] = useState(preferences.playbackStep);
  useEffect(() => setHours(preferences.playbackStep), [preferences.playbackStep]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setRun(null);
    setPoints([]);
    setError(null);
    if (!runId) {
      setRun(null);
      setPoints([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([getSimulationRun(runId), getSimulationTelemetry(runId)])
      .then(([nextRun, telemetry]) => {
        if (!cancelled) {
          setRun(nextRun);
          setPoints(telemetry.items);
        }
      })
      .catch((reason) => {
        if (!cancelled) setError(message(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId, revision]);

  useEffect(() => {
    setSession(null);
    setPending(null);
    setPlan(null);
    if (!monitoringId) {
      setSession(null);
      return;
    }
    let cancelled = false;
    getMonitoringSession(monitoringId)
      .then(async (nextSession) => {
        if (nextSession.simulation_run_id !== runId)
          throw new Error("The monitoring session belongs to another case.");
        const [nextPlan, nextPending] = await Promise.all([
          getPlan(nextSession.plan_version_id),
          nextSession.pending_proposal_id
            ? getPlan(nextSession.pending_proposal_id)
            : Promise.resolve(null),
        ]);
        if (!cancelled) {
          setSession(nextSession);
          setPlan(nextPlan);
          setPending(nextPending);
        }
      })
      .catch((reason) => {
        if (!cancelled) setError(message(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [monitoringId, runId, revision]);

  useEffect(() => {
    if (monitoringId || !planId) return;
    let cancelled = false;
    getPlan(planId)
      .then((nextPlan) => {
        if (nextPlan.source_simulation_run_id && nextPlan.source_simulation_run_id !== runId)
          throw new Error("The proposal belongs to another case.");
        if (!cancelled) setPlan(nextPlan);
      })
      .catch((reason) => {
        if (!cancelled) setError(message(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [monitoringId, planId, runId, revision]);

  const perform = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  };
  const start = () =>
    perform(async () => {
      if (!runId || !plan || plan.status !== "active")
        throw new Error("Select an active plan linked to the selected run before monitoring.");
      const checkpointSession = (
        plan.plan_snapshot["monitoring_replan"] as { session_id?: string } | undefined
      )?.session_id;
      const next = checkpointSession
        ? await getMonitoringSession(checkpointSession)
        : await createMonitoringSession(plan.id, runId);
      if (next.simulation_run_id !== runId)
        throw new Error("The saved session belongs to another case.");
      setSession(next);
      setMonitoringId(next.id);
      setPending(null);
      refreshWorkflow();
    });
  const advance = () =>
    perform(async () => {
      if (!session || !Number.isInteger(hours) || hours < 1 || hours > 24)
        throw new Error("Advance must be a whole number between 1 and 24 hours.");
      const next = await advanceMonitoring(session.id, hours, session.current_hour);
      setSession(next);
      setPending(next.pending_proposal_id ? await getPlan(next.pending_proposal_id) : null);
      refreshWorkflow();
    });
  const actOnPending = (action: "review" | "approve" | "reject" | "activate") =>
    perform(async () => {
      if (!pending) return;
      const next = await actOnPlan(
        pending.id,
        action,
        `Operator ${action} recorded from station monitoring`,
        operator.name,
      );
      setPending(next);
      if (action === "activate") {
        setPlan(next);
        setPlanId(next.id);
      }
      if (session) setSession(await getMonitoringSession(session.id));
      setRevision((value) => value + 1);
      refreshWorkflow();
    });

  const observation = session?.latest_observation;
  const canAdvance =
    session?.status === "monitoring" && plan?.status === "active" && !decisionPending(pending);
  const criticalAlerts =
    session?.active_alerts?.filter(
      (event) => event.severity === "critical" || event.severity === "high",
    ) ?? [];
  const activePlan = plan?.status === "active";
  return (
    <>
      <PageHeader
        eyebrow="Execution / operator-controlled"
        title="Station Monitoring"
        description="Track resource deviations, review alerts and authorize the next response."
        action={
          <Button
            variant="outline"
            onClick={() => setRevision((value) => value + 1)}
            disabled={loading || busy}
          >
            <RefreshCw size={15} />
            Refresh evidence
          </Button>
        }
      />
      {error && (
        <div
          role="alert"
          className="panel mb-5 flex flex-wrap items-center justify-between gap-3 border-destructive/35 p-4 text-sm text-destructive"
        >
          <span>{error}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setError(null);
              setRevision((value) => value + 1);
            }}
          >
            Retry
          </Button>
        </div>
      )}
      {!workflowLoaded || loading ? (
        <div role="status" className="panel p-6 text-sm text-muted-foreground">
          Loading saved monitoring evidence…
        </div>
      ) : !runId ? (
        <EmptyState />
      ) : !plan ? (
        <NoPlan />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
            <div>
              <section className="panel border-primary/30 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="micro-label text-primary">
                      Operating clock /{" "}
                      {session?.execution_policy === "generator_first_approved_missions_v1"
                        ? "approved mission execution"
                        : "case playback"}
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-bold">
                      {session
                        ? session.current_hour < 0
                          ? "Awaiting first observation"
                          : `Hour ${session.current_hour}`
                        : "Monitoring not started"}
                    </h2>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {session
                        ? `Original run: ${run?.scenario.replaceAll("_", " ")} · seed ${run?.seed} · ${run?.duration_days} days`
                        : "Start only after an operator has activated the linked proposal."}
                    </p>
                  </div>
                  <StatusBadge tone={activePlan ? "good" : "warn"}>
                    {activePlan
                      ? `ACTIVE PLAN · V${plan.version_number}`
                      : plan.status.toUpperCase()}
                  </StatusBadge>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric
                    label="Data source"
                    value="STATION MODEL"
                    note="saved scenario playback"
                  />
                  <Metric
                    label="Active plan"
                    value={`V${plan.version_number}`}
                    note={activePlan ? "operator activated" : "not executable"}
                  />
                  <Metric
                    label="Priority alerts"
                    value={session ? String(criticalAlerts.length) : "—"}
                    note={
                      !session
                        ? "monitoring not started"
                        : criticalAlerts.length
                          ? "currently active high/critical conditions"
                          : "none active"
                    }
                  />
                  <Metric
                    label="Next action"
                    value={
                      session && !canAdvance
                        ? "REVIEW"
                        : pending
                          ? "REPLAN"
                          : session
                            ? "ADVANCE"
                            : "START"
                    }
                    note={nextAction(session, plan, pending)}
                  />
                </div>
                <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
                  {!session ? (
                    <div className="space-y-2">
                      <Button onClick={start} disabled={busy || !activePlan}>
                        <Play size={15} />
                        {plan.plan_snapshot["monitoring_replan"]
                          ? "Resume operating session"
                          : "Start case playback"}
                      </Button>
                      <p className="max-w-md text-xs text-muted-foreground">
                        {activePlan
                          ? "Creates a saved observation session linked to this active plan; it does not switch physical sensors on."
                          : "Review, approve and activate this case’s proposal in Mission Planner first."}
                      </p>
                      {!activePlan && (
                        <Link
                          className="block text-xs text-primary underline"
                          to="/mission-planner"
                        >
                          Open Mission Planner
                        </Link>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-end gap-2">
                        <label className="w-28 text-xs text-muted-foreground">
                          Advance hours
                          <Input
                            type="number"
                            min={1}
                            max={24}
                            value={hours}
                            onChange={(event) => setHours(Number(event.target.value))}
                            className="mt-1"
                          />
                        </label>
                        <Button
                          onClick={advance}
                          disabled={
                            busy ||
                            !canAdvance ||
                            !Number.isInteger(hours) ||
                            hours < 1 ||
                            hours > 24
                          }
                        >
                          <ArrowRight size={15} />
                          Advance clock
                        </Button>
                      </div>
                      <p className="max-w-md text-xs text-muted-foreground">
                        {canAdvance
                          ? "Only saved observations through the selected simulated hour are shown."
                          : decisionPending(pending)
                            ? "Paused at the decision checkpoint. Review and activate or reject the proposal before continuing."
                            : "This operating horizon is complete or its plan is no longer active."}
                      </p>
                    </>
                  )}
                </div>
              </section>
              {observation && <ObservationGrid observation={observation} />}
            </div>
            <div className="space-y-4">
              <CheckpointProposal plan={pending} busy={busy} onAction={actOnPending} />
              {session && <AlertQueue events={session.events} />}
            </div>
          </div>
          {session && (
            <>
              {!observation && (
                <div className="panel mt-4 p-5 text-sm text-muted-foreground">
                  Advance the clock to reveal the first saved observation.
                </div>
              )}
              <MonitoringComparison
                points={session.trajectory ?? points}
                plan={plan}
                session={session}
              />
              <div className="mt-5">
                <MissionProgress items={observation?.mission_progress ?? []} />
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className="panel p-6">
      <SectionTitle>Nothing is being monitored yet</SectionTitle>
      <p className="mt-2 text-sm text-muted-foreground">
        Create a persisted simulation before opening the operational monitoring workspace.
      </p>
      <Button asChild className="mt-4">
        <Link to="/scenario-simulator">
          Create scenario run <ArrowRight size={14} />
        </Link>
      </Button>
    </div>
  );
}
function NoPlan() {
  return (
    <div className="panel p-6">
      <SectionTitle>No plan selected</SectionTitle>
      <p className="mt-2 text-sm text-muted-foreground">
        Monitoring needs an operator-activated plan linked to the selected simulation run.
      </p>
      <Button asChild className="mt-4">
        <Link to="/mission-planner">
          Open Mission Planner <ArrowRight size={14} />
        </Link>
      </Button>
    </div>
  );
}
function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded border border-border bg-secondary/20 p-3">
      <div className="micro-label">{label}</div>
      <div className="mt-2 font-display text-lg font-bold">{value}</div>
      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{note}</p>
    </div>
  );
}
function AlertQueue({ events }: { events: MonitoringSession["events"] }) {
  const ordered = [...events].sort((a, b) => b.hour - a.hour);
  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="micro-label text-muted-foreground">Event history / persisted</div>
          <h2 className="mt-1 font-display text-base font-bold">Recorded changes & decisions</h2>
        </div>
        <ShieldAlert size={19} className="text-warning" />
      </div>
      <div className="mt-4 max-h-52 space-y-2 overflow-y-auto pr-1">
        {ordered.length ? (
          ordered.map((event) => (
            <div key={event.id} className="rounded border border-warning/25 bg-warning/5 p-3">
              <div className="flex justify-between gap-2">
                <strong className="text-xs">
                  H{event.hour} · {event.rule.replaceAll("_", " ")}
                </strong>
                <StatusBadge
                  tone={
                    event.severity === "critical" || event.severity === "high" ? "critical" : "warn"
                  }
                >
                  {event.severity}
                </StatusBadge>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {event.action.replaceAll("_", " ")}
              </p>
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No alerts recorded for this session.
          </p>
        )}
      </div>
    </section>
  );
}
function ObservationGrid({
  observation,
}: {
  observation: NonNullable<MonitoringSession["latest_observation"]>;
}) {
  const { preferences } = useFirn();
  const weather = observation.weather ?? {};
  const values = [
    [
      "Battery",
      withUnit(observation.battery_kwh, "kWh"),
      delta(observation.forecast_comparison?.["battery_delta_kwh"], "kWh"),
    ],
    [
      "Fuel",
      withUnit(observation.fuel_liters, "L"),
      `${withUnit(observation.fuel_runway_hours, "h runway")} · ${delta(observation.forecast_comparison?.["fuel_delta_liters"], "L")}`,
    ],
    [
      "Renewable",
      withUnit(observation.renewable_kw, "kW"),
      delta(observation.forecast_comparison?.["renewable_delta_kw"], "kW"),
    ],
    [
      "Demand served",
      `${withUnit(observation.served_kw, "kW")} / ${withUnit(observation.demand_kw, "kW")}`,
      observation.critical_violation ? "CRITICAL LOAD VIOLATION" : "critical load served",
    ],
    [
      "Weather",
      String(weather["regime"] ?? "unavailable").toUpperCase(),
      `${formatTemperature(weather["temperature_c"], preferences.temperatureUnit)} · ${formatWind(weather["wind_kmh"], preferences.windUnit)}`,
    ],
    [
      "Generators",
      Object.entries(observation.generator_status ?? {})
        .map(([id, status]) => `${id}: ${status}`)
        .join(" · ") || "unavailable",
      "observed simulator state",
    ],
  ];
  return (
    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {values.map(([label, value, note]) => (
        <div
          key={label}
          className={`rounded border p-4 ${note === "CRITICAL LOAD VIOLATION" ? "border-destructive/50 bg-destructive/5" : "border-border bg-secondary/20"}`}
        >
          <div className="micro-label">{label} / observed</div>
          <div className="mt-2 font-display text-lg font-bold">{value}</div>
          <p className="mt-1 text-[10px] text-muted-foreground">{note}</p>
        </div>
      ))}
    </section>
  );
}
function MissionProgress({ items }: { items: Array<Record<string, unknown>> }) {
  return (
    <section className="panel p-5">
      <SectionTitle aside="scheduled state vs observed replay">Mission progress</SectionTitle>
      <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
        {items.length ? (
          items.map((item, index) => (
            <div
              key={`${String(item["mission_id"])}-${index}`}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-2 text-xs"
            >
              <strong>{String(item["mission_id"] ?? "Mission").replaceAll("-", " ")}</strong>
              <span className="text-muted-foreground">
                Plan: {missionState(item["planned_state"])} · Observed:{" "}
                {missionState(item["observed_state"])}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No mission status is available before the first observation.
          </p>
        )}
      </div>
    </section>
  );
}
function CheckpointProposal({
  plan,
  busy,
  onAction,
}: {
  plan: PlanVersion | null;
  busy: boolean;
  onAction: (action: "review" | "approve" | "reject" | "activate") => void;
}) {
  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="micro-label text-warning">Checkpoint proposal</div>
          <h2 className="mt-1 font-display text-base font-bold">
            {decisionPending(plan)
              ? `Version ${plan!.version_number} · operator decision`
              : "No approval pending"}
          </h2>
        </div>
        {decisionPending(plan) ? (
          <AlertTriangle size={19} className="text-warning" />
        ) : (
          <CheckCircle2 size={19} className="text-success" />
        )}
      </div>
      {plan && decisionPending(plan) ? (
        <>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            New plan from the saved observed checkpoint. The current active plan remains in force
            until approval and activation.
          </p>
          <CheckpointEvidence plan={plan} />
          <div className="mt-4 flex flex-wrap gap-2">
            {plan.status === "proposed" && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onAction("review")}
              >
                Review
              </Button>
            )}
            {plan.status === "reviewed" && (
              <Button size="sm" disabled={busy} onClick={() => onAction("approve")}>
                Approve
              </Button>
            )}
            {plan.status === "approved" && (
              <Button size="sm" disabled={busy} onClick={() => onAction("activate")}>
                Activate
              </Button>
            )}
            {["proposed", "reviewed", "approved"].includes(plan.status) && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onAction("reject")}
              >
                Reject
              </Button>
            )}
          </div>
          <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
            Activation carries the checkpoint's resources into approved remaining mission execution.
            Simulator dispatch remains distinct from MILP dispatch.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          The active plan remains in force. A material change can create a replacement for review.
        </p>
      )}
    </section>
  );
}
function withUnit(value: unknown, unit: string) {
  return typeof value === "number" ? `${value.toFixed(1)} ${unit}` : `— ${unit}`;
}
function delta(value: unknown, unit: string) {
  return typeof value === "number"
    ? `Plan Δ ${value >= 0 ? "+" : ""}${value.toFixed(1)} ${unit}`
    : "Plan comparison unavailable";
}
function nextAction(
  session: MonitoringSession | null,
  plan: PlanVersion,
  pending: PlanVersion | null,
) {
  if (!session) return plan.status === "active" ? "start saved playback" : "activate a plan first";
  if (pending && ["proposed", "reviewed", "approved"].includes(pending.status))
    return "review checkpoint proposal";
  return session.status === "monitoring" && plan.status === "active"
    ? "advance saved clock"
    : "review completed replay";
}
function message(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "FIRN could not complete this monitoring action.";
}
