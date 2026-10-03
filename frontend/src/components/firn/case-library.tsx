import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ArrowRight, RefreshCw } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useFirn } from "@/lib/firn-context";
import {
  getMonitoringSession,
  getPlan,
  getSimulationRun,
  getSimulationTelemetry,
  listPlans,
  listSimulationRuns,
} from "@/lib/firn-api";
import { validateOperatingSelection } from "@/lib/operations-model";
import { formatUtc, humanize } from "@/lib/display";

export function CaseLibrary() {
  const context = useFirn();
  return (
    <Modal
      open={context.caseLibraryOpen}
      onOpenChange={context.setCaseLibraryOpen}
      title="Open an operating case"
      description="Choose saved evidence and an optional plan. This changes your workspace selection, not backend records."
      wide
    >
      {context.caseLibraryOpen && <LibraryContent />}
    </Modal>
  );
}

function LibraryContent() {
  const { runId, planId, monitoringId, workflowRevision, selectWorkflow, setCaseLibraryOpen } =
    useFirn();
  const client = useQueryClient();
  const [caseId, setCaseId] = useState(runId ?? "");
  const [chosenPlan, setChosenPlan] = useState(planId ?? "");
  const [sessionId, setSessionId] = useState(monitoringId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runs = useQuery({
    queryKey: ["saved-cases"],
    queryFn: () => listSimulationRuns(100),
    retry: false,
    staleTime: 0,
  });
  const plans = useQuery({
    queryKey: ["saved-plans"],
    queryFn: () => listPlans(),
    retry: false,
    staleTime: 0,
  });
  const matchingPlans = (plans.data?.items ?? []).filter(
    (plan) => plan.source_simulation_run_id === caseId,
  );
  const openCase = async () => {
    setBusy(true);
    setError(null);
    try {
      const [run, telemetry, selectedPlan, session] = await Promise.all([
        getSimulationRun(caseId),
        getSimulationTelemetry(caseId),
        chosenPlan ? getPlan(chosenPlan) : null,
        sessionId.trim() ? getMonitoringSession(sessionId.trim()) : null,
      ]);
      const monitoredPlan = session
        ? session.plan_version_id === selectedPlan?.id
          ? selectedPlan
          : await getPlan(session.plan_version_id)
        : null;
      const data = { run, points: telemetry.items, selectedPlan, monitoredPlan, session };
      validateOperatingSelection(data);
      client.setQueryData(
        ["operating-workspace", caseId, chosenPlan || null, session?.id ?? null, workflowRevision],
        data,
      );
      selectWorkflow({
        runId: caseId,
        planId: chosenPlan || null,
        monitoringId: session?.id ?? null,
      });
      setCaseLibraryOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The case could not be opened.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="case-library">
      <div className="library-caption">
        <span>Latest 100 saved cases</span>
        <button
          className="text-button"
          onClick={() => {
            void runs.refetch();
            void plans.refetch();
          }}
          disabled={busy || runs.isFetching}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      {runs.isPending && (
        <p role="status" className="ops-empty">
          Retrieving saved cases…
        </p>
      )}
      {runs.error && (
        <p role="alert" className="inline-error">
          {runs.error.message}
        </p>
      )}
      {!runs.isPending && !runs.error && !runs.data?.items.length && (
        <p className="ops-empty">
          No saved cases yet. Create a run in the existing Scenario Simulator, then refresh this
          library.
        </p>
      )}
      <div className="case-list" role="radiogroup" aria-label="Saved operating cases">
        {(runs.data?.items ?? []).map((run) => (
          <button
            key={run.id}
            role="radio"
            aria-checked={caseId === run.id}
            className={`case-option ${caseId === run.id ? "is-selected" : ""}`}
            disabled={busy}
            onClick={() => {
              setCaseId(run.id);
              if (run.id !== caseId) {
                setChosenPlan("");
                setSessionId("");
              }
              setError(null);
            }}
          >
            <span className="case-radio">{caseId === run.id && <Check size={12} />}</span>
            <span>
              <strong>
                {humanize(run.scenario)} <span>· {run.duration_days} days</span>
              </strong>
              <small>
                {run.station_name} · Saved {formatUtc(run.created_at)}
              </small>
            </span>
          </button>
        ))}
      </div>
      <div className="library-selection">
        <label htmlFor="selected-plan">
          Plan to inspect <span>Optional · latest 50 saved plans</span>
        </label>
        <select
          id="selected-plan"
          value={chosenPlan}
          disabled={!caseId || busy}
          onChange={(event) => setChosenPlan(event.target.value)}
        >
          <option value="">No selected plan</option>
          {matchingPlans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              Version {plan.version_number} · {humanize(plan.status)} · {formatUtc(plan.created_at)}
            </option>
          ))}
          {chosenPlan && !matchingPlans.some((plan) => plan.id === chosenPlan) && (
            <option value={chosenPlan}>Previously selected plan — verified on open</option>
          )}
        </select>
        {plans.error && (
          <p role="alert" className="inline-error">
            Plan library unavailable: {plans.error.message}. You can open the case without a plan.
          </p>
        )}
        <details>
          <summary>Resume an existing monitoring session</summary>
          <label htmlFor="session-id">Saved session ID</label>
          <input
            id="session-id"
            value={sessionId}
            disabled={busy}
            onChange={(event) => setSessionId(event.target.value)}
            placeholder="Optional UUID"
          />
          <p>
            The session must belong to this case. Execution controls arrive in the next UI stage.
          </p>
        </details>
      </div>
      {error && (
        <p role="alert" className="inline-error">
          {error} Your current workspace is unchanged.
        </p>
      )}
      <div className="library-actions">
        <Button variant="outline" onClick={() => setCaseLibraryOpen(false)} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={() => void openCase()} disabled={!caseId || busy}>
          {busy ? "Verifying case…" : "Open case"}
          <ArrowRight size={15} />
        </Button>
      </div>
    </div>
  );
}
