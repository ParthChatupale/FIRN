import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, ChartNoAxesCombined, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionTitle, StatusBadge } from "@/components/firn/shell";
import { RunTimeline } from "@/components/firn/run-timeline";
import {
  getSimulationRun,
  getSimulationTelemetry,
  type SimulationRun,
  type TelemetryPoint,
} from "@/lib/firn-api";
import { useFirn } from "@/lib/firn-context";
import { LookAheadWorkspace } from "@/components/firn/look-ahead-workspace";

export const Route = createFileRoute("/forecast")({
  head: () => ({
    meta: [
      { title: "Look ahead — FIRN" },
      {
        name: "description",
        content: "Inspect the simulated resource trajectory from a persisted FIRN run.",
      },
    ],
  }),
  component: LookAheadWorkspace,
});

export function Forecast() {
  const { runId, workflowLoaded } = useFirn();
  if (!workflowLoaded)
    return (
      <div role="status" className="panel p-5 text-sm text-muted-foreground">
        Restoring workflow selection…
      </div>
    );
  return <ForecastRun key={runId ?? "empty"} runId={runId} />;
}

function ForecastRun({ runId }: { runId: string | null }) {
  const { setRunId, setPlanId, setMonitoringId, setPlanGenerated } = useFirn();
  const [run, setRun] = useState<SimulationRun | null>(null);
  const [points, setPoints] = useState<TelemetryPoint[]>([]);
  const [loading, setLoading] = useState(!!runId);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setRun(null);
    setPoints([]);
    setError(null);
    if (!runId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getSimulationRun(runId), getSimulationTelemetry(runId)])
      .then(([nextRun, page]) => {
        if (!cancelled) {
          setRun(nextRun);
          setPoints(page.items);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : "Could not load run telemetry.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId, retry]);

  function resetSelection() {
    setRunId(null);
    setPlanId(null);
    setMonitoringId(null);
    setPlanGenerated(false);
  }

  return (
    <>
      <PageHeader
        eyebrow="Simulation evidence / Resource outlook"
        title="Forecast & Risk"
        description="Inspect the selected run’s hourly synthetic resource trajectory. These curves are simulation output, not calibrated weather forecasts."
        action={
          <div className="flex flex-wrap items-center gap-3">
            {run && (
              <StatusBadge tone="neutral">
                SEED {run.seed} · {run.duration_days} DAYS
              </StatusBadge>
            )}
            {runId && (
              <Button variant="outline" onClick={resetSelection}>
                Clear workflow selection
              </Button>
            )}
          </div>
        }
      />
      {loading && (
        <div
          role="status"
          className="panel flex items-center gap-3 p-5 text-sm text-muted-foreground"
        >
          <LoaderCircle className="animate-spin text-primary" size={18} />
          Retrieving the full hourly series…
        </div>
      )}
      {error && (
        <div role="alert" className="panel border-destructive/30 p-5 text-sm text-destructive">
          {error}
          <p className="mt-2 break-all text-xs">
            Selected run: {runId}. Its plan and monitoring selection have been preserved.
          </p>
          <Button variant="outline" className="mt-3" onClick={() => setRetry((value) => value + 1)}>
            Retry telemetry
          </Button>
        </div>
      )}
      {!runId && !loading && (
        <div className="panel p-7">
          <ChartNoAxesCombined className="text-primary" />
          <SectionTitle>There is no selected simulation run yet</SectionTitle>
          <p className="mb-4 text-sm text-muted-foreground">
            Create a seeded scenario or resume a saved run to inspect its resource trajectory.
            Clearing the workflow selection does not delete saved backend records.
          </p>
          <Button asChild>
            <Link to="/scenario-simulator">
              Create or resume a run <ArrowRight size={14} />
            </Link>
          </Button>
        </div>
      )}
      {run && !loading && !error && (
        <>
          <div className="panel mb-5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="micro-label text-primary">
                  Persisted run · {run.scenario.replaceAll("_", " ")}
                </div>
                <h2 className="mt-1 font-display text-lg font-bold">{run.station_name}</h2>
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Case evidence</summary>
                  <p className="mt-2 break-all">
                    Run {run.id} · simulator {run.simulator_version} ·{" "}
                    {points.length.toLocaleString()} hourly records loaded
                  </p>
                </details>
              </div>
              <Button asChild variant="outline">
                <Link to="/mission-planner">
                  Review a joint plan <ArrowRight size={14} />
                </Link>
              </Button>
            </div>
          </div>
          <div className="panel p-5 md:p-6">
            <SectionTitle aside="One shared simulated-hour horizon">
              Resource trajectory
            </SectionTitle>
            {points.length > 0 ? (
              <RunTimeline points={points} />
            ) : (
              <div className="text-sm text-muted-foreground">
                <p>
                  This saved run has no hourly telemetry. The summary below comes from its persisted
                  run record.
                </p>
                <Button
                  className="mt-3"
                  variant="outline"
                  onClick={() => setRetry((value) => value + 1)}
                >
                  Reload telemetry
                </Button>
              </div>
            )}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Renewable share"
              value={`${run.summary.renewable_share_percent}%`}
              note="of served energy"
            />
            <Metric
              label="Minimum battery"
              value={`${run.summary.battery_min_kwh} kWh`}
              note={`ending at ${run.summary.battery_final_kwh} kWh`}
            />
            <Metric
              label="Fuel remaining"
              value={`${run.summary.fuel_remaining_liters} L`}
              note="at simulation end"
            />
            <Metric
              label="Critical-load violations"
              value={`${run.summary.critical_violation_hours} h`}
              note={`${run.summary.unserved_energy_kwh} kWh unserved`}
            />
          </div>
          <details className="mt-4 text-[11px] leading-5 text-muted-foreground">
            <summary className="cursor-pointer">Outlook methodology</summary>
            <p className="mt-2">
              Uncertainty is not shown as a probability band: current forecasts and trajectories use
              deterministic synthetic assumptions and are not calibrated against station
              observations.
            </p>
          </details>
        </>
      )}
    </>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="panel p-4">
      <div className="micro-label">{label}</div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{note}</div>
    </div>
  );
}
