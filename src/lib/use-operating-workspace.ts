import { useQuery } from "@tanstack/react-query";
import { useFirn } from "./firn-context";
import {
  getMonitoringSession,
  getPlan,
  getSimulationRun,
  getSimulationTelemetry,
  listPlans,
} from "./firn-api";
import { planMatchesRun, sessionMatchesRun, resolveCursor } from "./workspace-model";

/** Shared query keys prevent independent pages choosing different 'current' observations. */
export function useOperatingWorkspace() {
  const { runId, planId, monitoringId, workflowLoaded, workflowRevision, refreshWorkflow } =
    useFirn();
  const options = { retry: false as const, staleTime: 30_000, refetchOnWindowFocus: false };
  const runQuery = useQuery({
    ...options,
    queryKey: ["firn", "run", runId, workflowRevision],
    queryFn: () => getSimulationRun(runId!),
    enabled: workflowLoaded && !!runId,
  });
  const telemetryQuery = useQuery({
    ...options,
    queryKey: ["firn", "telemetry", runId, workflowRevision],
    queryFn: () => getSimulationTelemetry(runId!),
    enabled: workflowLoaded && !!runId,
  });
  const sessionQuery = useQuery({
    ...options,
    queryKey: ["firn", "session", monitoringId, workflowRevision],
    queryFn: () => getMonitoringSession(monitoringId!),
    enabled: workflowLoaded && !!runId && !!monitoringId,
  });
  const selectedId = planId ?? sessionQuery.data?.plan_version_id ?? null;
  const planQuery = useQuery({
    ...options,
    queryKey: ["firn", "plan", selectedId, workflowRevision],
    queryFn: () => getPlan(selectedId!),
    enabled: workflowLoaded && !!runId && !!selectedId,
  });
  const activeQuery = useQuery({
    ...options,
    queryKey: ["firn", "active", workflowRevision],
    queryFn: () => listPlans("active"),
    enabled: workflowLoaded && !!runQuery.data,
  });
  const run = runQuery.isError ? null : (runQuery.data ?? null);
  const rawSession = sessionQuery.isError ? null : (sessionQuery.data ?? null);
  const rawPlan = planQuery.isError ? null : (planQuery.data ?? null);
  const sessionMismatch = !!rawSession && (!run || !sessionMatchesRun(rawSession, run));
  const planMismatch = !!rawPlan && (!run || !planMatchesRun(rawPlan, run));
  const session = sessionMismatch ? null : rawSession;
  const plan = planMismatch ? null : rawPlan;
  const points = telemetryQuery.isError
    ? []
    : (session?.trajectory ?? telemetryQuery.data?.items ?? []);
  const resolved = resolveCursor(run, session, points);
  const errors = [runQuery.error, telemetryQuery.error, sessionQuery.error, planQuery.error].filter(
    Boolean,
  );
  const error =
    errors[0] instanceof Error
      ? errors[0].message
      : sessionMismatch
        ? "The selected monitoring session belongs to another case."
        : planMismatch
          ? "The selected proposal belongs to another case."
          : null;
  const loading =
    !workflowLoaded ||
    [runQuery, telemetryQuery, sessionQuery, planQuery].some((q) => q.isFetching);
  const cursor =
    error || loading
      ? {
          ...resolved,
          point: null,
          label: loading ? "Loading operating clock…" : "Operating clock unavailable",
        }
      : resolved;
  const activePlan = activeQuery.isError
    ? null
    : (activeQuery.data?.items.find((p) => p.station_name === run?.station_name) ?? null);
  return {
    run,
    plan,
    session,
    points,
    cursor,
    activePlan,
    activeLoading: activeQuery.isFetching,
    activeError: activeQuery.error,
    loading,
    error,
    planMismatch,
    sessionMismatch,
    refresh: refreshWorkflow,
  };
}
