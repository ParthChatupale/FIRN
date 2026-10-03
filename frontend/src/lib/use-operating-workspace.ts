import { useQuery } from "@tanstack/react-query";
import { useFirn } from "./firn-context";
import {
  getMonitoringSession,
  getPlan,
  getSimulationRun,
  getSimulationTelemetry,
  getSimulationEvents,
} from "./firn-api";
import {
  operatingSnapshot,
  validateOperatingSelection,
  type OperatingData,
} from "./operations-model";

const empty: OperatingData = {
  run: null,
  points: [],
  selectedPlan: null,
  monitoredPlan: null,
  session: null,
};

// The shell and Operations use the same query so time and plan identity stay consistent.
export function useOperatingWorkspace() {
  const { runId, planId, monitoringId, workflowLoaded, workflowRevision, reviewHour } = useFirn();
  const query = useQuery({
    queryKey: ["operating-workspace", runId, planId, monitoringId, workflowRevision],
    enabled: workflowLoaded,
    retry: false,
    staleTime: 30_000,
    queryFn: async (): Promise<OperatingData> => {
      const [session, selectedPlan] = await Promise.all([
        monitoringId ? getMonitoringSession(monitoringId) : null,
        planId ? getPlan(planId) : null,
      ]);
      const monitoredPlan = session
        ? session.plan_version_id === selectedPlan?.id
          ? selectedPlan
          : await getPlan(session.plan_version_id)
        : null;
      const effectiveRunId =
        runId ?? session?.simulation_run_id ?? selectedPlan?.source_simulation_run_id;
      const [run, telemetry] = await Promise.all([
        effectiveRunId ? getSimulationRun(effectiveRunId) : null,
        effectiveRunId ? getSimulationTelemetry(effectiveRunId) : null,
      ]);
      const data = { run, points: telemetry?.items ?? [], selectedPlan, monitoredPlan, session };
      validateOperatingSelection(data);
      return data;
    },
  });
  const data = query.data ?? empty;
  const events = useQuery({
    queryKey: ["case-events", data.run?.id],
    enabled: !!data.run,
    retry: false,
    queryFn: () => getSimulationEvents(data.run!.id),
  });
  return {
    ...data,
    snapshot: operatingSnapshot(data, reviewHour),
    runEvents: events.data ?? [],
    eventsError: events.error?.message ?? null,
    loading: !workflowLoaded || query.isPending,
    refreshing: query.isFetching && !query.isPending,
    error: query.error?.message ?? null,
    checkedAt: query.dataUpdatedAt,
    refresh: () => void query.refetch(),
  };
}
