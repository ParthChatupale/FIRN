import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Clock3,
  LoaderCircle,
  Play,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { MonitoringComparison } from "@/components/firn/monitoring-comparison";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlanningEvidence, PlanningFailureDetail } from "@/components/firn/planning-evidence";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, SectionTitle, StatusBadge } from "@/components/firn/shell";
import { useFirn } from "@/lib/firn-context";
import { readPlanningInputs, proposalRequestKey } from "@/lib/planning-inputs";
import { planEnergyRow, numberLabel, planScopeCompatible } from "@/lib/operations-metrics";
import { useOperatingWorkspace } from "@/lib/use-operating-workspace";
import {
  actOnPlan,
  advanceMonitoring,
  comparePlanVersions,
  createMonitoringSession,
  createPlanProposal,
  editPlan,
  getMonitoringSession,
  getPlan,
  getPlanVersions,
  getSimulationRun,
  getSimulationTelemetry,
  listPlans,
  FirnApiError,
  type PlanningMode,
  type TelemetryPoint,
  type MonitoringSession,
  type PlanComparison,
  type PlanDispatchPoint,
  type PlanScheduleItem,
  type PlanVersion,
  type SimulationRun,
} from "@/lib/firn-api";

export const Route = createFileRoute("/mission-planner")({
  head: () => ({
    meta: [
      { title: "Mission Planner — FIRN" },
      {
        name: "description",
        content:
          "Simulated mission scheduling aligned with energy availability, deadlines and asset constraints.",
      },
      { property: "og:title", content: "Mission Planner — FIRN" },
      {
        property: "og:description",
        content: "Explore mission-aware and energy-aware scheduling for a polar station.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Planner,
});
function Planner() {
  const operating = useOperatingWorkspace();
  const {
    runId,
    planId,
    setPlanId,
    monitoringId,
    setMonitoringId,
    workflowLoaded,
    operator,
    preferences,
    refreshWorkflow,
  } = useFirn();
  const [run, setRun] = useState<SimulationRun | null>(null);
  const [plan, setPlan] = useState<PlanVersion | null>(null);
  const [session, setSession] = useState<MonitoringSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failureDetail, setFailureDetail] = useState<unknown>(null);
  const [planningMode, setPlanningMode] = useState<PlanningMode>("saved");
  const [flexibility, setFlexibility] = useState(12);
  useEffect(() => {
    try {
      const saved = readPlanningInputs(
        JSON.parse(localStorage.getItem("firn:planning-inputs") ?? "null"),
      );
      setPlanningMode(saved.mode);
      setFlexibility(saved.flexibility);
    } catch {
      /* Defaults remain available if browser storage is blocked. */
    }
  }, []);
  function updatePlanningInputs(mode: PlanningMode, hours: number) {
    setPlanningMode(mode);
    setFlexibility(hours);
    try {
      localStorage.setItem("firn:planning-inputs", JSON.stringify({ mode, flexibility: hours }));
    } catch {
      /* Proposal submission separately reports storage failures. */
    }
  }
  const [inspectedMission, setInspectedMission] = useState("");
  const [editMission, setEditMission] = useState("");
  const [editHour, setEditHour] = useState("");
  const [advanceHours, setAdvanceHours] = useState(preferences.playbackStep);
  useEffect(() => setAdvanceHours(preferences.playbackStep), [preferences.playbackStep]);
  const [pendingPlan, setPendingPlan] = useState<PlanVersion | null>(null);
  const [comparison, setComparison] = useState<PlanComparison | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [monitoredPlan, setMonitoredPlan] = useState<PlanVersion | null>(null);
  const [savedPlans, setSavedPlans] = useState<PlanVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setRun(null);
    setTelemetry([]);
    if (!runId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getSimulationRun(runId), getSimulationTelemetry(runId)])
      .then(([value, series]) => {
        if (!cancelled) {
          setRun(value);
          setTelemetry(series.items);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(message(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId, revision]);
  useEffect(() => {
    let cancelled = false;
    listPlans()
      .then((value) => {
        if (!cancelled) setSavedPlans(value.items);
      })
      .catch((e) => {
        if (!cancelled) setError(message(e));
      });
    return () => {
      cancelled = true;
    };
  }, [runId, planId, plan?.status, revision]);
  useEffect(() => {
    setPlan(null);
    setComparison(null);
    setEditMission("");
    setEditHour("");
    if (!planId) return;
    let cancelled = false;
    getPlan(planId)
      .then(async (value) => {
        if (cancelled) return;
        setPlan(value);
        const versions = await getPlanVersions(value.plan_group_id);
        const earlier = versions.items
          .filter((item) => item.version_number < value.version_number)
          .sort((a, b) => b.version_number - a.version_number)[0];
        if (
          earlier &&
          !value.plan_snapshot["monitoring_replan"] &&
          !earlier.plan_snapshot["monitoring_replan"] &&
          planScopeCompatible(earlier, value)
        ) {
          const diff = await comparePlanVersions(
            value.plan_group_id,
            earlier.version_number,
            value.version_number,
          );
          if (!cancelled) setComparison(diff);
        } else if (!cancelled) setComparison(null);
      })
      .catch((e) => {
        if (!cancelled) setError(message(e));
      });
    return () => {
      cancelled = true;
    };
  }, [planId, revision]);
  useEffect(() => {
    setSession(null);
    setPendingPlan(null);
    setMonitoredPlan(null);
    if (!monitoringId) return;
    let cancelled = false;
    getMonitoringSession(monitoringId)
      .then(async (value) => {
        const [original, pending] = await Promise.all([
          getPlan(value.plan_version_id),
          value.pending_proposal_id ? getPlan(value.pending_proposal_id) : Promise.resolve(null),
        ]);
        if (!cancelled) {
          setSession(value);
          setMonitoredPlan(original);
          setPendingPlan(pending);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(message(e));
      });
    return () => {
      cancelled = true;
    };
  }, [monitoringId, planId, plan?.status, revision]);

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setFailureDetail(null);
    try {
      await action();
    } catch (reason) {
      setError(message(reason));
      if (reason instanceof FirnApiError) setFailureDetail(reason.detail);
    } finally {
      setBusy(false);
    }
  }
  const propose = () =>
    perform(async () => {
      if (!runId) throw new Error("Run a scenario before generating a plan.");
      if (!run || run.duration_days > 30)
        throw new Error("Plan generation requires a loaded run with a horizon of 30 days or less.");
      if (!Number.isInteger(flexibility) || flexibility < 0 || flexibility > 48)
        throw new Error("Flexibility must be a whole number between 0 and 48 hours.");
      const retryKey = proposalRequestKey(runId, planningMode, flexibility);
      const requestId = localStorage.getItem(retryKey) ?? crypto.randomUUID();
      localStorage.setItem(retryKey, requestId);
      const created = await createPlanProposal({
        source_simulation_run_id: runId,
        flexibility_hours: flexibility,
        planning_mode: planningMode,
        request_id: requestId,
      });
      localStorage.removeItem(retryKey);
      setPlan(created);
      setPlanId(created.id);
    });
  const planAction = (action: "review" | "approve" | "activate" | "reject") =>
    perform(async () => {
      if (!plan) return;
      const updated = await actOnPlan(
        plan.id,
        action,
        action === "review"
          ? "Operator review started in FIRN workspace"
          : `Operator ${action} recorded in FIRN workspace`,
        operator.name,
      );
      setPlan(updated);
      setPlanId(updated.id);
    });
  const saveEdit = () =>
    perform(async () => {
      if (!plan || !activeEditMission) throw new Error("Select a scheduled mission first.");
      const hour = Number(editHour === "" ? activeEditMission.start_hour : editHour);
      if (!Number.isInteger(hour) || hour < 0 || hour >= plan.days * 24)
        throw new Error("Enter a whole start hour within this plan's horizon.");
      if (hour === activeEditMission.start_hour)
        throw new Error("Choose a different start hour to create an edited version.");
      const retryKey = `firn:edit-request:${plan.id}:${activeEditMission.mission_id}:${hour}:${operator.name}`;
      const requestId = localStorage.getItem(retryKey) ?? crypto.randomUUID();
      localStorage.setItem(retryKey, requestId);
      const updated = await editPlan(
        plan.id,
        { [activeEditMission.mission_id]: hour },
        operator.name,
        requestId,
      );
      localStorage.removeItem(retryKey);
      setPlan(updated);
      setPlanId(updated.id);
      setEditMission("");
      setEditHour("");
    });
  const startMonitoring = () =>
    perform(async () => {
      if (!plan || !runId) return;
      const created = await createMonitoringSession(plan.id, runId);
      setSession(created);
      setMonitoredPlan(plan);
      setMonitoringId(created.id);
    });
  const advance = () =>
    perform(async () => {
      if (!session || !Number.isInteger(advanceHours) || advanceHours < 1 || advanceHours > 24)
        throw new Error("Advance must be a whole number between 1 and 24 hours.");
      const updated = await advanceMonitoring(session.id, advanceHours);
      setSession(updated);
      refreshWorkflow();
      if (updated.pending_proposal_id) setPendingPlan(await getPlan(updated.pending_proposal_id));
    });
  const pendingAction = (action: "review" | "approve" | "activate" | "reject") =>
    perform(async () => {
      if (!pendingPlan) return;
      const updated = await actOnPlan(
        pendingPlan.id,
        action,
        `Operator ${action} of monitoring checkpoint proposal`,
        operator.name,
      );
      setPendingPlan(updated);
      refreshWorkflow();
      if (action === "activate") {
        setPlan(updated);
        setPlanId(updated.id);
        if (session) setMonitoredPlan(await getPlan(session.plan_version_id));
      }
    });
  const selectedMissions = (plan?.plan_snapshot.schedule ?? []).filter((item) => item.selected);
  const activeEditMission =
    selectedMissions.find((item) => item.mission_id === editMission) ?? selectedMissions[0];
  const checkpoint = Boolean(plan?.plan_snapshot["monitoring_replan"]);
  const activePlan = operating.activePlan;
  const sessionCanAdvance = session?.status === "monitoring" && monitoredPlan?.status === "active";

  return (
    <>
      <PageHeader
        eyebrow="Joint planning / Operator-controlled"
        title="Mission Planner"
        description="Align mission windows, station resources and energy dispatch. Review every proposal before activation."
        action={
          <Button onClick={propose} disabled={busy || !runId || !run || run.duration_days > 30}>
            <Sparkles size={15} />
            {busy ? "Working…" : "Generate proposal"}
          </Button>
        }
      />
      <div className="panel mb-5 flex flex-wrap items-end gap-4 p-4 text-xs text-muted-foreground">
        <label>
          Weather planning policy
          <select
            aria-label="Weather planning policy"
            value={planningMode}
            disabled={busy}
            onChange={(e) => updatePlanningInputs(e.target.value as PlanningMode, flexibility)}
            className="mt-1 block h-10 rounded border border-input bg-background px-3 text-sm"
          >
            <option value="saved">Saved case weather</option>
            <option value="nominal">Nominal trajectory</option>
            <option value="adverse">Adverse renewable trajectory</option>
            <option value="robust">Conservative three-case envelope</option>
          </select>
        </label>
        <label>
          Timing flexibility (± hours)
          <Input
            aria-label="Timing flexibility"
            type="number"
            min={0}
            max={48}
            value={flexibility}
            disabled={busy}
            onChange={(e) => updatePlanningInputs(planningMode, Number(e.target.value))}
            className="mt-1 w-36"
          />
        </label>
        <span className="max-w-md">
          {planningMode === "robust"
            ? "Hourly worst-case weather envelope across nominal, low-renewable and storm cases. No probability guarantee."
            : "Station configuration, disruptions and resupply are preserved from the selected case."}
        </span>
      </div>
      {error && (
        <div role="alert" className="panel mb-5 border-destructive/30 p-4 text-sm text-destructive">
          {error}
          <PlanningFailureDetail detail={failureDetail} />
          <Button
            variant="outline"
            size="sm"
            className="ml-3"
            onClick={() => {
              setError(null);
              setRevision((value) => value + 1);
            }}
          >
            Reload workspace
          </Button>
          <span className="ml-3 text-xs text-muted-foreground">
            If a request timed out, reload saved versions or retry the same action with unchanged
            inputs.
          </span>
        </div>
      )}
      {(!workflowLoaded || loading || (planId && !plan && !error)) && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Loading saved workspace…
        </p>
      )}
      {workflowLoaded && !runId && (
        <div className="panel mb-5 p-6">
          <SectionTitle>No simulation selected</SectionTitle>
          <p className="mb-4 text-sm text-muted-foreground">
            A plan must be tied to a reproducible run so its scenario, seed, horizon, and starting
            conditions remain inspectable.
          </p>
          <Button asChild>
            <Link to="/scenario-simulator">
              Create a scenario run <ArrowRight size={14} />
            </Link>
          </Button>
        </div>
      )}
      {savedPlans.some((item) => item.source_simulation_run_id === runId) && (
        <div className="panel mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
          <label className="text-xs text-muted-foreground">
            Saved proposals for this run
            <select
              aria-label="Saved proposal"
              value={planId ?? ""}
              onChange={(event) => setPlanId(event.target.value || null)}
              className="ml-3 max-w-full rounded border border-input bg-background p-2"
            >
              <option value="">Choose a proposal</option>
              {savedPlans
                .filter((item) => item.source_simulation_run_id === runId)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    Version {item.version_number} · {item.status} · {item.id.slice(0, 8)}
                  </option>
                ))}
            </select>
          </label>
          <span className="text-xs text-muted-foreground">
            {operating.activeError
              ? "Station active plan unavailable"
              : operating.activeLoading
                ? "Checking station active plan…"
                : activePlan
                  ? `Station active plan: v${activePlan.version_number} · ${activePlan.id.slice(0, 8)}`
                  : "No active station plan"}
          </span>
        </div>
      )}
      {run && (
        <div className="panel mb-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="micro-label text-primary">Planning basis</div>
              <h2 className="mt-1 font-display text-base font-bold">
                {run.scenario.replaceAll("_", " ")} · {run.duration_days} days
              </h2>
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Case details</summary>
                <p className="mt-2 break-all">
                  Run {run.id} · seed {run.seed} · {run.simulator_version}
                </p>
              </details>
            </div>
            <StatusBadge tone="neutral">SAVED CASE</StatusBadge>
          </div>
        </div>
      )}
      {run && run.duration_days > 30 && (
        <div className="panel mb-5 border-warning/30 p-4 text-sm text-warning">
          The selected run exceeds the optimizer’s 30-day proposal limit. Create a run of 30 days or
          fewer to continue into planning.
        </div>
      )}
      {plan && (
        <>
          <div className="panel mb-5 border-primary/25 p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="micro-label text-primary">
                  Persisted plan · version {plan.version_number}
                </div>
                <h2 className="mt-1 font-display text-lg font-bold">
                  Joint mission–energy proposal
                </h2>
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Model & solver details</summary>
                  <p className="mt-2 break-all">
                    Group {plan.plan_group_id} · {plan.planner_model_version} · solver{" "}
                    {plan.solver_name} {plan.solver_version}
                  </p>
                </details>
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
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <PlanMetric
                label="Missions scheduled"
                value={`${selectedMissions.length} / ${(plan.plan_snapshot.schedule ?? []).length}`}
                note="from saved optimizer schedule"
              />
              <PlanMetric
                label="Model replay completed"
                value={String(plan.explanations.replay_impact?.["missions_completed"] ?? "—")}
                note="missions in simulator replay"
              />
              <PlanMetric
                label="Fuel remaining"
                value={
                  plan.explanations.replay_impact?.["fuel_remaining_liters"] == null
                    ? "—"
                    : `${plan.explanations.replay_impact["fuel_remaining_liters"]} L`
                }
                note="end of modeled horizon"
              />
              <PlanMetric
                label="Critical violations"
                value={`${plan.explanations.replay_impact?.["critical_violation_hours"] ?? "—"} h`}
                note="simulator replay metric"
              />
            </div>
            <div className="mt-6">
              <SectionTitle aside="optimizer dispatch · shared hour axis">
                Proposed energy trajectory
              </SectionTitle>
              <PlanDispatchCharts points={plan.plan_snapshot.dispatch ?? []} />
            </div>
            <div className="mt-6 space-y-5">
              <div>
                <SectionTitle aside="scheduled and deferred work">Mission schedule</SectionTitle>
                <MissionScheduleTimeline
                  schedule={plan.plan_snapshot.schedule ?? []}
                  hours={plan.days * 24}
                  onSelect={setInspectedMission}
                />
                <label className="mt-3 block text-xs text-muted-foreground">
                  Inspect mission restrictions
                  <select
                    aria-label="Inspect mission restrictions"
                    value={inspectedMission || plan.plan_snapshot.schedule?.[0]?.mission_id || ""}
                    onChange={(e) => setInspectedMission(e.target.value)}
                    className="mt-1 h-10 w-full rounded border border-input bg-background px-3"
                  >
                    {(plan.plan_snapshot.schedule ?? []).map((m) => (
                      <option key={m.mission_id} value={m.mission_id}>
                        {m.mission_id}
                      </option>
                    ))}
                  </select>
                </label>
                <PlanningEvidence
                  plan={plan}
                  run={run}
                  missionId={inspectedMission || plan.plan_snapshot.schedule?.[0]?.mission_id}
                />
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {(plan.plan_snapshot.schedule ?? []).map((item) => (
                    <div
                      key={item.mission_id}
                      className="grid gap-2 rounded border border-border bg-secondary/20 p-3 sm:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <div className="text-sm font-semibold">
                          {item.mission_id.replaceAll("-", " ")}
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {item.selected
                            ? `Start hour ${item.start_hour} · ${item.duration_hours} h · ${item["priority"] ?? "modeled priority"}`
                            : item.reason}
                        </p>
                      </div>
                      <StatusBadge tone={item.selected ? "good" : "warn"}>
                        {item.selected ? "SCHEDULED" : "NOT SELECTED"}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              </div>
              <details>
                <summary className="mb-3 cursor-pointer text-sm font-semibold text-primary">
                  Decision explanations & constraint evidence
                </summary>
                <SectionTitle aside="derived from plan explanations">
                  Why this proposal?
                </SectionTitle>
                <div className="space-y-2">
                  {(plan.explanations.mission_decisions ?? []).map((decision, i) => (
                    <div
                      key={`${String(decision["mission_id"])}-${i}`}
                      className="rounded border border-border bg-secondary/20 p-3"
                    >
                      <div className="text-xs font-semibold">
                        {String(decision["mission_id"] ?? "Mission")} ·{" "}
                        {String(decision["decision"] ?? "")}
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        {String(decision["reason"] ?? "")}
                      </p>
                    </div>
                  ))}
                  {(plan.explanations.binding_constraint_evidence ?? []).map((item) => (
                    <div
                      key={item.constraint}
                      className="rounded border border-warning/25 bg-warning/5 p-3"
                    >
                      <div className="text-xs font-semibold">
                        Constraint evidence · {item.constraint.replaceAll("_", " ")}
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        {item.explanation}
                        {item.evidence_hours.length
                          ? ` Hours: ${item.evidence_hours.slice(0, 8).join(", ")}${item.evidence_hours.length > 8 ? "…" : ""}.`
                          : ""}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
                  {plan.explanations.interpretation_limit}
                </p>
              </details>
            </div>
            {comparison && (
              <div className="mt-5 rounded border border-primary/20 bg-primary/5 p-4">
                <SectionTitle
                  aside={`version ${comparison.baseline_version} → ${comparison.candidate_version}`}
                >
                  What changed in this version?
                </SectionTitle>
                {comparison.mission_changes.length ? (
                  <div className="space-y-2">
                    {comparison.mission_changes.map((change) => (
                      <div
                        key={change.mission_id}
                        className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs"
                      >
                        <span className="font-semibold">
                          {change.mission_id.replaceAll("-", " ")}
                        </span>
                        <span className="text-right text-muted-foreground">
                          {change.before.selected ? "selected" : "not selected"}
                          {change.before.start_hour != null
                            ? ` · hour ${change.before.start_hour}`
                            : ""}{" "}
                          → {change.after.selected ? "selected" : "not selected"}
                          {change.after.start_hour != null
                            ? ` · hour ${change.after.start_hour}`
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    The comparison API reports no mission-selection or timing changes between these
                    versions.
                  </p>
                )}
                <div className="mt-3 grid gap-2 text-[10px] text-muted-foreground sm:grid-cols-2">
                  <span>
                    Objective deltas:{" "}
                    {Object.entries(comparison.objective_delta)
                      .map(([key, value]) => `${key.replaceAll("_", " ")} ${value ?? "—"}`)
                      .join(" · ") || "not reported"}
                  </span>
                  <span>
                    Replay deltas:{" "}
                    {Object.entries(comparison.replay_delta)
                      .map(([key, value]) => `${key.replaceAll("_", " ")} ${value ?? "—"}`)
                      .join(" · ") || "not reported"}
                  </span>
                </div>
              </div>
            )}
            {selectedMissions.length > 0 &&
              !checkpoint &&
              ["proposed", "reviewed"].includes(plan.status) && (
                <div className="mt-5 rounded border border-border bg-secondary/20 p-4">
                  <SectionTitle aside="creates a new immutable version">
                    Operator timing edit
                  </SectionTitle>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="min-w-48 flex-1 text-xs text-muted-foreground">
                      Scheduled mission
                      <select
                        className="mt-1 h-10 w-full rounded border border-input bg-background px-3 text-sm"
                        value={activeEditMission?.mission_id ?? ""}
                        onChange={(e) => {
                          setEditMission(e.target.value);
                          setEditHour("");
                        }}
                      >
                        {selectedMissions.map((item) => (
                          <option key={item.mission_id} value={item.mission_id}>
                            {item.mission_id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="w-36 text-xs text-muted-foreground">
                      New start hour
                      <Input
                        type="number"
                        min={0}
                        max={plan.days * 24 - 1}
                        value={editHour || String(activeEditMission?.start_hour ?? 0)}
                        onChange={(e) => setEditHour(e.target.value)}
                        className="mt-1"
                      />
                    </label>
                    <Button
                      variant="outline"
                      onClick={saveEdit}
                      disabled={busy || !activeEditMission}
                    >
                      Validate & save edit
                    </Button>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    The optimizer revalidates the requested start against the modeled constraints.
                    An infeasible edit is rejected and does not change this version.
                  </p>
                </div>
              )}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
              {plan.status === "proposed" && (
                <Button variant="outline" onClick={() => planAction("review")} disabled={busy}>
                  Record review
                </Button>
              )}
              {plan.status === "reviewed" && (
                <>
                  <Button onClick={() => planAction("approve")} disabled={busy}>
                    Approve proposal
                  </Button>
                  <Button variant="outline" onClick={() => planAction("reject")} disabled={busy}>
                    Reject
                  </Button>
                </>
              )}
              {plan.status === "approved" && (
                <Button onClick={() => planAction("activate")} disabled={busy}>
                  Activate approved plan
                </Button>
              )}
              {plan.status === "active" && (
                <StatusBadge tone="good">ACTIVE PLAN · OPERATOR ACTIVATED</StatusBadge>
              )}
            </div>
          </div>
        </>
      )}
      {(session || (plan?.status === "active" && runId)) && (
        <div className="panel mb-5 flex flex-wrap items-center justify-between gap-4 border-primary/25 p-5">
          <div>
            <div className="micro-label text-primary">Execution workspace</div>
            <h2 className="mt-1 font-display text-base font-bold">
              Monitoring is now a dedicated view
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Open the operational dashboard for the simulation clock, deviations, alerts, mission
              progress, and checkpoint decisions.
            </p>
          </div>
          <Button asChild>
            <Link to="/monitoring">
              Open Station Monitoring <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
      )}
      {/* Monitoring is routed to its own operational workspace. Keep this stateful block mounted
          but hidden until it is extracted in a maintenance pass, so the existing session controls
          remain available without duplicating them visually. */}
      {(session || (plan?.status === "active" && runId)) && (
        <div id="monitoring" className="hidden">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="micro-label text-primary">Execution / simulated monitoring</div>
              <h2 className="mt-1 font-display text-lg font-bold">Station monitoring</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Advance the saved simulation clock to compare observed synthetic state with the
                active plan. Monitoring never activates a revision on its own.
              </p>
            </div>
            {!session && !checkpoint && (
              <Button onClick={startMonitoring} disabled={busy}>
                <Play size={15} />
                Start monitoring
              </Button>
            )}
          </div>
          {session && (
            <>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-primary/20 bg-primary/5 p-4">
                <div>
                  <div className="micro-label text-primary">Operator next action</div>
                  <p className="mt-1 text-sm">
                    {!sessionCanAdvance
                      ? monitoredPlan?.status === "superseded"
                        ? "Replacement activated. Review the saved checkpoint and history; original-run playback has ended."
                        : "Playback complete. Review the outcome and decision history."
                      : pendingPlan &&
                          ["proposed", "reviewed", "approved"].includes(pendingPlan.status)
                        ? "Inspect the checkpoint proposal below before approval or rejection."
                        : session.current_hour < 0
                          ? "Advance the clock to observe the first simulated hour."
                          : "Inspect deviations and alerts, then advance the station clock."}
                  </p>
                </div>
                <StatusBadge tone={sessionCanAdvance ? "neutral" : "good"}>
                  {sessionCanAdvance ? "OPERATOR-STEPPED" : "PLAYBACK STOPPED"}
                </StatusBadge>
              </div>
              <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded border border-border bg-secondary/20 p-4">
                <div>
                  <div className="micro-label">Simulation clock</div>
                  <div className="mt-1 font-display text-xl font-bold">
                    {session.current_hour < 0 ? "Not started" : `Hour ${session.current_hour}`}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">Session {session.id}</div>
                </div>
                <div className="flex items-end gap-2">
                  <label className="w-32 text-xs text-muted-foreground">
                    Advance hours
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={advanceHours}
                      onChange={(e) => setAdvanceHours(Number(e.target.value))}
                      className="mt-1"
                    />
                  </label>
                  <Button
                    onClick={advance}
                    disabled={
                      busy ||
                      !sessionCanAdvance ||
                      !Number.isInteger(advanceHours) ||
                      advanceHours < 1 ||
                      advanceHours > 24
                    }
                  >
                    <ArrowRight size={14} />
                    Advance clock
                  </Button>
                </div>
              </div>
              {monitoredPlan && (
                <MonitoringComparison points={telemetry} plan={monitoredPlan} session={session} />
              )}
              {session.latest_observation && (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <PlanMetric
                      label="Renewable output"
                      value={`${session.latest_observation.renewable_kw ?? "—"} kW`}
                      note={`plan Δ ${session.latest_observation.forecast_comparison?.["renewable_delta_kw"] ?? "—"} kW`}
                    />
                    <PlanMetric
                      label="Station demand"
                      value={`${session.latest_observation.demand_kw ?? "—"} kW`}
                      note={`${session.latest_observation.served_kw ?? "—"} kW served`}
                    />
                    <PlanMetric
                      label="Battery"
                      value={`${session.latest_observation.battery_kwh ?? "—"} kWh`}
                      note={`plan Δ ${session.latest_observation.forecast_comparison?.["battery_delta_kwh"] ?? "—"} kWh`}
                    />
                    <PlanMetric
                      label="Fuel"
                      value={`${session.latest_observation.fuel_liters ?? "—"} L`}
                      note={`plan Δ ${session.latest_observation.forecast_comparison?.["fuel_delta_liters"] ?? "—"} L`}
                    />
                  </div>
                  {(session.latest_observation.mission_progress?.length ?? 0) > 0 && (
                    <div className="mt-4 rounded border border-border bg-secondary/15 p-4">
                      <SectionTitle aside={`at simulated hour ${session.current_hour}`}>
                        Mission progress versus active schedule
                      </SectionTitle>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {session.latest_observation.mission_progress?.map((mission, index) => (
                          <div
                            key={`${String(mission["mission_id"])}-${index}`}
                            className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs"
                          >
                            <span className="font-semibold">
                              {String(mission["mission_id"] ?? "Mission")}
                            </span>
                            <span className="text-muted-foreground">
                              planned: {String(mission["planned_state"] ?? "—")} · observed:{" "}
                              {String(mission["observed_state"] ?? "—")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {session.events.length === 0 && (
                <div className="mt-4 rounded border border-border p-4 text-xs text-muted-foreground">
                  No monitoring alerts have been recorded
                  {session.current_hour < 0
                    ? "; playback has not started"
                    : ` through hour ${session.current_hour}`}
                  .
                </div>
              )}
              {session.events.length > 0 && (
                <div className="mt-5">
                  <SectionTitle aside={`${session.events.length} persisted checkpoint event(s)`}>
                    Monitoring signals
                  </SectionTitle>
                  <div className="space-y-2">
                    {session.events
                      .slice()
                      .reverse()
                      .map((event) => (
                        <div
                          key={event.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded border border-warning/25 bg-warning/5 p-3"
                        >
                          <div>
                            <div className="text-xs font-semibold">
                              Hour {event.hour} · {event.rule.replaceAll("_", " ")}
                            </div>
                            <p className="mt-1 text-[10px] text-muted-foreground">{event.action}</p>
                          </div>
                          <StatusBadge tone={event.severity === "critical" ? "critical" : "warn"}>
                            {event.severity}
                          </StatusBadge>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {session.pending_proposal_id && (
                <div className="mt-5 rounded border border-warning/35 bg-warning/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="micro-label text-warning">
                        Checkpoint proposal · awaits operator
                      </div>
                      <h3 className="mt-1 text-sm font-bold">
                        A monitored change produced a new plan version
                      </h3>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        The currently active plan remains in force until this proposal completes
                        review, approval, and activation.
                      </p>
                    </div>
                    {pendingPlan && (
                      <StatusBadge tone="warn">{pendingPlan.status.toUpperCase()}</StatusBadge>
                    )}
                  </div>
                  {pendingPlan && (
                    <div className="mt-4 space-y-4">
                      <div className="text-xs text-muted-foreground">
                        Checkpoint v{pendingPlan.version_number} · {pendingPlan.days}-day remaining
                        horizon. Hour 0 is the checkpoint start, not the original run start.
                        Cross-horizon totals are not savings comparisons.
                      </div>
                      <MissionScheduleTimeline
                        schedule={pendingPlan.plan_snapshot.schedule ?? []}
                        hours={pendingPlan.days * 24}
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(pendingPlan.explanations.mission_decisions ?? []).map(
                          (decision, index) => (
                            <div
                              key={index}
                              className="rounded border border-border bg-background/40 p-3 text-xs"
                            >
                              <strong>{String(decision["mission_id"] ?? "Mission")}</strong>
                              <p className="mt-1 text-muted-foreground">
                                {String(
                                  decision["reason"] ??
                                    decision["decision"] ??
                                    "No explanation recorded",
                                )}
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                      <PlanDispatchCharts points={pendingPlan.plan_snapshot.dispatch ?? []} />
                      <p className="text-xs text-muted-foreground">
                        {pendingPlan.explanations.interpretation_limit} Activation preserves this
                        session's history but stops original-run playback; checkpoint continuation
                        requires a future backend extension.
                      </p>
                    </div>
                  )}
                  {pendingPlan && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["proposed", "reviewed", "approved"].includes(pendingPlan.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => pendingAction("reject")}
                          disabled={busy}
                        >
                          Reject checkpoint
                        </Button>
                      )}
                      {pendingPlan.status === "proposed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => pendingAction("review")}
                          disabled={busy}
                        >
                          Review checkpoint
                        </Button>
                      )}
                      {pendingPlan.status === "reviewed" && (
                        <Button size="sm" onClick={() => pendingAction("approve")} disabled={busy}>
                          Approve checkpoint
                        </Button>
                      )}
                      {pendingPlan.status === "approved" && (
                        <Button size="sm" onClick={() => pendingAction("activate")} disabled={busy}>
                          Activate new version
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
      <details className="mt-5 rounded border border-border p-4">
        <summary className="cursor-pointer text-xs font-semibold text-primary">
          Evidence interpretation
        </summary>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          FIRN displays optimizer decisions, modeled constraint-limit evidence, and simulator replay
          outcomes. Constraint evidence indicates a value reached a configured limit; it is not
          causal proof or a guarantee of operational safety.
        </p>
      </details>
    </>
  );
}

function PlanMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded border border-border bg-secondary/25 p-3">
      <div className="micro-label">{label}</div>
      <div className="mt-2 font-display text-xl font-bold">{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">{note}</div>
    </div>
  );
}
function message(error: unknown) {
  return error instanceof Error ? error.message : "FIRN could not complete this request.";
}
function MissionScheduleTimeline({
  schedule,
  hours,
  onSelect,
}: {
  schedule: PlanScheduleItem[];
  hours: number;
  onSelect?: (missionId: string) => void;
}) {
  const planned = schedule.filter(
    (item) => item.selected && item.start_hour != null && item.start_hour < hours,
  );
  return (
    <div className="rounded border border-border bg-secondary/15 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Full {hours}-hour plan horizon
        </span>
        <span className="text-[10px] text-muted-foreground">mission windows</span>
      </div>
      <div className="relative ml-28 h-5 border-b border-border">
        {[0, Math.round(hours / 3), Math.round((hours * 2) / 3), hours].map((hour) => (
          <span
            key={hour}
            className="absolute bottom-0 translate-x-[-50%] text-[9px] text-muted-foreground"
            style={{ left: `${(hour / hours) * 100}%` }}
          >
            H{hour}
          </span>
        ))}
      </div>
      {planned.length === 0 ? (
        <p className="py-4 text-xs text-muted-foreground">No selected missions in this horizon.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {planned.map((item) => (
            <div key={item.mission_id} className="grid grid-cols-[7rem_1fr] items-center gap-2">
              {onSelect ? (
                <button
                  className="truncate text-left text-xs text-primary underline"
                  title={`Inspect ${item.mission_id}`}
                  onClick={() => onSelect(item.mission_id)}
                >
                  {item.mission_id}
                </button>
              ) : (
                <div className="truncate text-xs" title={item.mission_id}>
                  {item.mission_id}
                </div>
              )}
              <div className="relative h-5 overflow-hidden rounded bg-secondary">
                <span
                  className="absolute inset-y-0 rounded bg-primary/70"
                  style={{
                    left: `${(Number(item.start_hour) / hours) * 100}%`,
                    width: `${Math.min(((hours - Number(item.start_hour)) / hours) * 100, Math.max(0.5, (Number(item.duration_hours ?? 1) / hours) * 100))}%`,
                  }}
                  title={`Starts at hour ${item.start_hour}; ${item.duration_hours} hours`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function PlanDispatchCharts({ points }: { points: PlanDispatchPoint[] }) {
  const gradientId = useId();
  const data = points.map(planEnergyRow);
  if (!data.length)
    return (
      <div className="rounded border border-border p-5 text-xs text-muted-foreground">
        This saved plan has no dispatch time series.
      </div>
    );
  const axis = { fill: "var(--muted-foreground)", fontSize: 9 };
  const chartStyle = {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "var(--foreground)",
    fontSize: 10,
  };
  const interval = Math.max(1, Math.floor(data.length / 8));
  return (
    <>
      <div className="grid gap-3 xl:grid-cols-3">
        <div className="rounded border border-border bg-secondary/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold">Supply / demand / renewables</span>
            <span className="micro-label">kW</span>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
                <XAxis
                  dataKey="hour"
                  tick={axis}
                  interval={interval}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={axis} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={chartStyle}
                  labelFormatter={(hour) => `Simulated hour ${hour}`}
                />
                <Line
                  dataKey="supply_kw"
                  isAnimationActive={false}
                  name="Total planned supply"
                  stroke="var(--primary)"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  dataKey="renewable_used_kw"
                  isAnimationActive={false}
                  name="Renewable used"
                  stroke="var(--success)"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  dataKey="demand_kw"
                  isAnimationActive={false}
                  name="Planned demand"
                  stroke="var(--warning)"
                  strokeDasharray="5 3"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded border border-border bg-secondary/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold">Battery state</span>
            <span className="micro-label">kWh</span>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--warning)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
                <XAxis
                  dataKey="hour"
                  tick={axis}
                  interval={interval}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={axis} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={chartStyle}
                  labelFormatter={(hour) => `Simulated hour ${hour}`}
                />
                <Area
                  dataKey="battery_soc_kwh"
                  isAnimationActive={false}
                  name="Battery SOC"
                  stroke="var(--warning)"
                  fill={`url(#${gradientId})`}
                  dot={false}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded border border-border bg-secondary/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold">Fuel inventory</span>
            <span className="micro-label">L</span>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
                <XAxis
                  dataKey="hour"
                  tick={axis}
                  interval={interval}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={axis} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={chartStyle}
                  labelFormatter={(hour) => `Simulated hour ${hour}`}
                />
                <Line
                  dataKey="fuel_liters"
                  isAnimationActive={false}
                  name="Modeled fuel"
                  stroke="var(--primary)"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Full dispatch: H0–H{data.length - 1}. These are optimizer dispatch values, separate from the
        simulator replay trajectory.
      </p>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-primary">Inspect dispatch values</summary>
        <div className="mt-2 max-h-60 overflow-auto">
          <table className="w-full whitespace-nowrap text-right">
            <caption className="p-2 text-left">
              Supply includes renewable dispatch, generators and battery discharge. Charging is an
              additional sink.
            </caption>
            <thead>
              <tr>
                {[
                  "Hour",
                  "Demand kW",
                  "Supply kW",
                  "Renewables kW",
                  "Generators kW",
                  "Battery discharge kW",
                  "Battery charge kW",
                  "Battery kWh",
                  "Fuel L",
                ].map((label) => (
                  <th className="p-2" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr className="border-t border-border" key={p.hour}>
                  <th className="p-2">H{p.hour}</th>
                  {[
                    p.demand_kw,
                    p.supply_kw,
                    p.renewable_used_kw,
                    p.generator_total_kw,
                    p.battery_discharge_kw,
                    p.battery_charge_kw,
                    p.battery_soc_kwh,
                    p.fuel_liters,
                  ].map((v, i) => (
                    <td className="p-2" key={i}>
                      {numberLabel(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
