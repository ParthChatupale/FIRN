import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle, Play, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, ScenarioChip, SectionTitle, StatusBadge } from "@/components/firn/shell";
import { RunTimeline } from "@/components/firn/run-timeline";
import { useFirn } from "@/lib/firn-context";
import type { ScenarioId } from "@/lib/firn-data";
import { formatRecordTime } from "@/lib/workspace-model";
import {
  createSimulationRun,
  listSimulationRuns,
  getSimulationRun,
  getSimulationTelemetry,
  type ApiScenario,
  type SimulationRun,
  type TelemetryPoint,
} from "@/lib/firn-api";

export const Route = createFileRoute("/scenario-simulator")({
  head: () => ({
    meta: [
      { title: "Scenario Simulator — FIRN" },
      {
        name: "description",
        content:
          "Run a repeatable synthetic station scenario and inspect its persisted resource trajectory.",
      },
    ],
  }),
  component: Simulator,
});

const apiScenarios: Record<ScenarioId, ApiScenario> = {
  normal: "normal",
  storm: "storm",
  generator: "generator_failure",
  fuel: "resupply_delay",
  battery: "battery_capacity_loss",
};

function Simulator() {
  const {
    scenarioId,
    runId,
    planId,
    monitoringId,
    workflowLoaded,
    setRunId,
    setPlanId,
    setMonitoringId,
    setPlanGenerated,
    preferences,
  } = useFirn();
  const [days, setDays] = useState(14);
  const [seed, setSeed] = useState(42);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedRun, setRun] = useState<SimulationRun | null>(null);
  const [points, setPoints] = useState<TelemetryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [savedRuns, setSavedRuns] = useState<SimulationRun[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [listRevision, setListRevision] = useState(0);
  const action = useRef(0);
  const run = loadedRun?.id === runId ? loadedRun : null;
  useEffect(() => {
    // Invalidate pending actions when another route changes the workflow or we unmount.
    action.current += 1;
    setRunning(false);
    return () => {
      action.current += 1;
    };
  }, [runId, planId, monitoringId]);
  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    setListError(null);
    listSimulationRuns(100)
      .then((page) => {
        if (!cancelled) setSavedRuns(page.items);
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setListError(reason instanceof Error ? reason.message : "Could not list saved runs.");
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listRevision]);
  useEffect(() => {
    setRun(null);
    setPoints([]);
    setLoadError(null);
    setLoading(false);
    if (!runId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getSimulationRun(runId), getSimulationTelemetry(runId)])
      .then(([saved, page]) => {
        if (!cancelled) {
          setRun(saved);
          setPoints(page.items);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setLoadError(
            reason instanceof Error ? reason.message : "Could not restore the selected run.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId, retry]);

  async function runSimulation(savedId?: string) {
    const request = ++action.current;
    setRunning(true);
    setError(null);
    let createdId: string | null = null;
    try {
      const saved = savedId
        ? await getSimulationRun(savedId)
        : await createSimulationRun({ scenario: apiScenarios[scenarioId], days, seed });
      if (!savedId) createdId = saved.id;
      const telemetry = await getSimulationTelemetry(saved.id);
      if (request !== action.current) return;
      // Commit selection only after the replacement is available. Failures preserve the workflow.
      if (saved.id !== runId) {
        setPlanId(null);
        setMonitoringId(null);
        setPlanGenerated(false);
      }
      setRun(saved);
      setPoints(telemetry.items);
      setLoadError(null);
      setRunId(saved.id);
      setListRevision((value) => value + 1);
    } catch (reason) {
      if (request !== action.current) return;
      const message =
        reason instanceof Error
          ? reason.message
          : "Could not load the simulation. Check the API connection and inputs.";
      setError(
        `${message} Your previous selection is unchanged.${createdId ? ` Run ${createdId} was saved, but its telemetry could not be loaded. Resume it from saved runs.` : ""}`,
      );
      setListRevision((value) => value + 1);
    } finally {
      if (request === action.current) setRunning(false);
    }
  }

  function resetSelection() {
    action.current += 1;
    setRunning(false);
    setRunId(null);
    setPlanId(null);
    setMonitoringId(null);
    setPlanGenerated(false);
    setRun(null);
    setPoints([]);
    setError(null);
    setLoadError(null);
    setLoading(false);
  }

  return (
    <>
      <PageHeader
        eyebrow="Operating cases / Scenario preparation"
        title="Scenario Simulator"
        description="Choose a modeled condition, run it with a visible seed, and inspect the complete persisted trajectory."
        action={
          (runId || planId || monitoringId) && (
            <Button
              variant="outline"
              disabled={running || !workflowLoaded}
              onClick={resetSelection}
            >
              Clear workflow selection
            </Button>
          )
        }
      />
      <div className="panel mb-5 p-5">
        <SectionTitle
          aside={
            <Button
              variant="outline"
              size="sm"
              disabled={listLoading || running}
              onClick={() => setListRevision((value) => value + 1)}
            >
              Refresh saved runs
            </Button>
          }
        >
          Resume a saved run
        </SectionTitle>
        <p className="mb-3 text-xs text-muted-foreground">
          The latest 100 saved runs are available here. Selecting a different run clears the
          selected plan and monitoring session only after the run loads. Clearing a selection does
          not delete backend records.
        </p>
        {listLoading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading saved runs…
          </p>
        ) : listError ? (
          <p role="alert" className="text-sm text-destructive">
            {listError} Use Refresh saved runs to retry.
          </p>
        ) : savedRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved runs. Create a scenario below.</p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {savedRuns.map((saved) => (
              <div
                key={saved.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {saved.scenario.replaceAll("_", " ")} · {saved.duration_days} days · seed{" "}
                    {saved.seed}
                  </div>
                  <p className="break-all text-[10px] text-muted-foreground">
                    Saved {formatRecordTime(saved.created_at, preferences.timezone)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!workflowLoaded || running || loading || saved.id === runId}
                  onClick={() => runSimulation(saved.id)}
                >
                  {saved.id === runId ? "Selected" : "Resume run"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="panel mb-5 p-5 md:p-6">
        <div className="mb-4">
          <div className="micro-label text-primary">01 / Define the case</div>
          <h2 className="mt-1 font-display text-base font-bold">Operating condition</h2>
          <p className="mt-1 text-xs text-muted-foreground">Choose the conditions to evaluate.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["normal", "storm", "generator", "fuel", "battery"] as ScenarioId[]).map((id) => (
            <ScenarioChip key={id} id={id} />
          ))}
        </div>
      </div>
      <div className="panel mb-5 p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="micro-label text-primary">02 / Prepare the horizon</div>
            <h2 className="mt-1 font-display text-base font-bold">
              Create a reproducible simulation run
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              2–30 days. The seed makes the case reproducible.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="w-28 text-xs text-muted-foreground">
              Days
              <Input
                aria-label="Duration in days"
                type="number"
                min={2}
                max={30}
                disabled={running}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="mt-1"
              />
            </label>
            <label className="w-32 text-xs text-muted-foreground">
              Random seed
              <Input
                aria-label="Random seed"
                type="number"
                value={seed}
                disabled={running}
                onChange={(e) => setSeed(Number(e.target.value))}
                className="mt-1"
              />
            </label>
            <Button
              onClick={() => runSimulation()}
              disabled={
                !workflowLoaded ||
                loading ||
                running ||
                !Number.isInteger(days) ||
                days < 2 ||
                days > 30 ||
                !Number.isSafeInteger(seed)
              }
              className="min-w-40"
            >
              {running ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  Loading run…
                </>
              ) : (
                <>
                  <Play />
                  Run scenario
                </>
              )}
            </Button>
          </div>
        </div>
        {(!workflowLoaded || loading) && (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin" size={16} />
            {workflowLoaded
              ? "Loading the selected run and telemetry…"
              : "Restoring workflow selection…"}
          </p>
        )}
        {workflowLoaded && !runId && (
          <p className="mt-4 text-sm text-muted-foreground">
            No run selected. Create a scenario or resume a saved run above.
          </p>
        )}
        {runId && loadError && (
          <div
            role="alert"
            className="mt-4 rounded border border-destructive/35 p-3 text-sm text-destructive"
          >
            <p>{loadError}</p>
            <p className="mt-1 break-all text-xs">
              Selected run: {runId}. Retry loading or clear the workflow selection.
            </p>
            <Button
              className="mt-3"
              variant="outline"
              disabled={loading || running}
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry selected run
            </Button>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="mt-4 rounded border border-destructive/35 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}
        {run && !loading && !loadError && (
          <div className="mt-6 border-t border-border pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="micro-label text-success">Persisted run / retrieved from API</div>
                <h3 className="mt-1 font-display text-lg font-bold">
                  {run.scenario.replaceAll("_", " ")}
                </h3>
                <details className="mt-1 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Case evidence</summary>
                  <p className="mt-2 break-all">
                    {run.id} · {run.duration_days} days · seed {run.seed} · {run.simulator_version}
                  </p>
                </details>
              </div>
              <StatusBadge tone={points.length ? "good" : "warn"}>
                {points.length.toLocaleString()} HOURLY RECORDS
              </StatusBadge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                [
                  "Missions completed",
                  run.summary.missions_completed,
                  `${run.summary.missions_failed} failed`,
                ],
                ["Renewable share", `${run.summary.renewable_share_percent}%`, "of served energy"],
                [
                  "Battery at end",
                  `${run.summary.battery_final_kwh} kWh`,
                  `minimum ${run.summary.battery_min_kwh} kWh`,
                ],
                ["Fuel at end", `${run.summary.fuel_remaining_liters} L`, "end of case"],
                [
                  "Critical violations",
                  `${run.summary.critical_violation_hours} h`,
                  `${run.summary.unserved_energy_kwh} kWh unserved`,
                ],
              ].map(([label, value, note]) => (
                <div
                  key={String(label)}
                  className="rounded border border-border bg-secondary/25 p-3"
                >
                  <div className="micro-label">{label}</div>
                  <div className="mt-2 font-display text-xl font-bold">{value}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{note}</div>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <SectionTitle aside="hourly simulation output">Run trajectory</SectionTitle>
              {points.length ? (
                <RunTimeline points={points} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  This saved run has no hourly telemetry. Summary values above are from its
                  persisted run record.
                </p>
              )}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded border border-primary/25 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 text-primary" size={18} />
                <div>
                  <div className="text-sm font-semibold">
                    Next: generate a joint mission–energy proposal
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Review and approve the linked plan before activation.
                  </p>
                </div>
              </div>
              <Button asChild>
                <Link to="/mission-planner">
                  Continue to planning <ArrowRight size={14} />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
      <details className="text-[10px] leading-5 text-muted-foreground">
        <summary className="cursor-pointer">Case methodology</summary>
        <p className="mt-2">
          All values shown are generated from the synthetic station model. No real Antarctic station
          data or equipment is connected.
        </p>
      </details>
    </>
  );
}
