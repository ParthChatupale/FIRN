import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BatteryCharging, CircleAlert, Fuel, Sun, Wind, Zap } from "lucide-react";
import { PageHeader, SectionTitle, StatusBadge } from "@/components/firn/shell";
import { Button } from "@/components/ui/button";
import { useFirn } from "@/lib/firn-context";
import { assetData } from "@/lib/firn-data";
import { useOperatingWorkspace } from "@/lib/use-operating-workspace";
import {
  getMonitoringSession,
  getSimulationRun,
  getSimulationTelemetry,
  getStationProfile,
  type MonitoringSession,
  type StationProfile,
  type TelemetryPoint,
} from "@/lib/firn-api";
export const Route = createFileRoute("/energy-assets")({
  head: () => ({
    meta: [
      { title: "Energy & Assets — FIRN" },
      {
        name: "description",
        content:
          "Inspect the synthetic reference station configuration and selected simulation state.",
      },
      { property: "og:title", content: "Energy & Assets — FIRN" },
      {
        property: "og:description",
        content: "See configured energy assets and modeled operating constraints.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductAssets,
});
const icons = [Sun, Wind, BatteryCharging, Zap, Fuel];
export function IllustrativeAssets() {
  const { scenario, scenarioId } = useFirn();
  return (
    <>
      <PageHeader
        eyebrow="Infrastructure / Asset-Aware Planning"
        title="Energy & Assets"
        description="The operating plan only uses energy infrastructure that is actually available."
      />
      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {assetData.map((a, i) => {
          const Icon = icons[i]!;
          const availability =
            i === 0
              ? `${scenario.solar} kW expected`
              : i === 1
                ? `${scenario.windPower} kW expected`
                : i === 2
                  ? `${scenario.battery}% SOC`
                  : a.available;
          return (
            <div key={a.name} className="panel p-5 transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between">
                <div className="flex size-10 items-center justify-center rounded border border-primary/20 bg-primary/10 text-primary">
                  <Icon size={20} />
                </div>
                <StatusBadge tone={a.status === "Maintenance" ? "warn" : "good"}>
                  {a.status}
                </StatusBadge>
              </div>
              <div className="micro-label mt-5">
                {a.type} / ASSET 0{i + 1}
              </div>
              <h2 className="mt-1 font-display text-lg font-bold">{a.name}</h2>
              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
                <div>
                  <div className="micro-label">Capacity</div>
                  <div className="mt-1 text-sm font-semibold">
                    {scenarioId === "battery" && i === 2 ? "153 kWh usable" : a.capacity}
                  </div>
                </div>
                <div>
                  <div className="micro-label">Current availability</div>
                  <div className="mt-1 text-sm font-semibold">{availability}</div>
                </div>
                <div>
                  <div className="micro-label">
                    {i === 2 ? "Temperature" : "Health / Condition"}
                  </div>
                  <div className="mt-1 text-sm font-semibold">{a.condition}</div>
                </div>
                <div>
                  <div className="micro-label">Constraint</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {scenarioId === "battery" && i === 2
                      ? "Extreme cold · capacity −30%"
                      : a.constraint}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="panel border-warning/30 bg-warning/5 p-5">
        <div className="flex items-start gap-3">
          <CircleAlert size={19} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <SectionTitle>Asset Constraint</SectionTitle>
            <p className="text-sm">Generator 02 unavailable due to scheduled maintenance.</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              FIRN excludes this asset from the available energy plan and keeps Generator 01 as
              critical backup.{" "}
              {scenarioId === "generator"
                ? "Generator failure scenario active: critical loads receive priority."
                : ""}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function ProductAssets() {
  const { runId, monitoringId, workflowLoaded } = useFirn();
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
        eyebrow="Station resources / Constraints"
        title="Energy & Assets"
        description="Inspect the selected run’s saved assets and constraints, with measurements at the monitoring clock when a session is selected."
        action={
          <Button variant="outline" onClick={() => setRevision((value) => value + 1)}>
            Refresh assets
          </Button>
        }
      />
      <AssetState
        key={JSON.stringify([runId, monitoringId, revision])}
        runId={runId}
        monitoringId={monitoringId}
      />
    </>
  );
}

function AssetState({
  runId,
  monitoringId,
}: {
  runId: string | null;
  monitoringId: string | null;
}) {
  const workspace = useOperatingWorkspace();
  const [data, setData] = useState<{
    name: string;
    configuration: StationProfile["configuration"];
    points: TelemetryPoint[];
    session: MonitoringSession | null;
    hasRun: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const session = monitoringId ? await getMonitoringSession(monitoringId) : null;
      if (session && runId && session.simulation_run_id !== runId)
        throw new Error(
          "The selected monitoring session belongs to a different run. Select a matching workflow in the planner.",
        );
      const selectedRunId = runId ?? session?.simulation_run_id;
      if (selectedRunId) {
        const [run, telemetry] = await Promise.all([
          getSimulationRun(selectedRunId),
          getSimulationTelemetry(selectedRunId),
        ]);
        const configuration = run.config_snapshot.station;
        if (!configuration?.battery || !Array.isArray(configuration.generators))
          throw new Error("The selected run has no complete saved station configuration.");
        if (!cancelled)
          setData({
            name: run.station_name,
            configuration,
            points: telemetry.items,
            session,
            hasRun: true,
          });
      } else {
        const profile = await getStationProfile();
        if (!cancelled)
          setData({
            name: profile.name,
            configuration: profile.configuration,
            points: [],
            session: null,
            hasRun: false,
          });
      }
    }
    void load().catch((reason) => {
      if (!cancelled)
        setError(reason instanceof Error ? reason.message : "Could not load station assets.");
    });
    return () => {
      cancelled = true;
    };
  }, [runId, monitoringId]);
  if (error)
    return (
      <div role="alert" className="panel p-5 text-sm text-destructive">
        {error} Use Refresh assets to retry.
      </div>
    );
  if (!data)
    return (
      <div role="status" className="panel p-5 text-sm text-muted-foreground">
        Loading station configuration and measurements…
      </div>
    );
  const { configuration: cfg, points, session, hasRun } = data;
  const latest = workspace.cursor.point;
  const initial = !hasRun;
  const measurement = hasRun
    ? workspace.cursor.label
    : "Reference configuration · no case selected";
  const output = (value: number | undefined) =>
    value == null ? "Output not recorded" : `${value} kW output`;
  const cards = [
    {
      name: "Solar array",
      type: "Renewable",
      capacity: `${cfg.solar_capacity_kw} kW rated`,
      available: latest ? output(latest.solar_kw) : "No observation available",
      constraint: "Modeled solar output from the saved hourly telemetry.",
      icon: Sun,
    },
    {
      name: "Wind generation",
      type: "Renewable",
      capacity: `${cfg.wind_capacity_kw} kW rated`,
      available: latest ? output(latest.wind_kw) : "No observation available",
      constraint: "Modeled wind output from the saved hourly telemetry.",
      icon: Wind,
    },
    {
      name: "Battery storage",
      type: "Storage",
      capacity: `${cfg.battery.capacity_kwh} kWh`,
      available: latest
        ? `${latest.battery_kwh} kWh · ${latest.battery_soc_percent}% SOC`
        : initial
          ? `${cfg.battery.initial_kwh} kWh configured initial`
          : "Measurement unavailable",
      constraint: `${cfg.battery.reserve_kwh} kWh reserve · ${cfg.battery.max_charge_kw} kW charge / ${cfg.battery.max_discharge_kw} kW discharge`,
      icon: BatteryCharging,
    },
    ...cfg.generators.map((generator) => ({
      name: generator.name,
      type: "Generator",
      capacity: `${generator.capacity_kw} kW`,
      available: latest
        ? `${latest.generator_status?.[generator.id]?.replaceAll("_", " ") ?? "Status not recorded"} · ${output(latest.generator_output_kw?.[generator.id])}`
        : initial
          ? generator.initially_available
            ? "Configured initially available"
            : "Configured initially unavailable"
          : "Measurement unavailable",
      constraint: `Minimum output ${generator.minimum_kw} kW · ${generator.liters_per_kwh} L/kWh`,
      icon: Zap,
    })),
    {
      name: "Fuel inventory",
      type: "Resupply",
      capacity: `${cfg.fuel_capacity_liters} L tank`,
      available: latest
        ? `${latest.fuel_liters} L`
        : initial
          ? `${cfg.initial_fuel_liters} L configured initial`
          : "Measurement unavailable",
      constraint: "Resupply timing and fuel use are modeled in the simulation.",
      icon: Fuel,
    },
  ];
  return (
    <>
      <div className="panel mb-5 p-4">
        <div className="text-sm font-semibold">
          {data.name} · {measurement}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {hasRun
            ? "Configuration comes from the selected run’s saved station snapshot."
            : "Reference assets are shown until a simulation run is selected."}
        </p>
        {hasRun && !initial && !latest && (
          <p role="status" className="mt-2 text-sm text-warning">
            No telemetry is available for this hour.
          </p>
        )}
      </div>
      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((asset, index) => {
          const Icon = asset.icon;
          return (
            <div key={`${asset.type}-${index}`} className="panel p-5">
              <div className="flex items-start justify-between">
                <div className="flex size-10 items-center justify-center rounded border border-primary/20 bg-primary/10 text-primary">
                  <Icon size={20} />
                </div>
                <StatusBadge>{asset.type}</StatusBadge>
              </div>
              <div className="micro-label mt-5">CONFIGURED ASSET {index + 1}</div>
              <h2 className="mt-1 font-display text-lg font-bold">{asset.name}</h2>
              <div className="mt-5 space-y-4 border-t border-border pt-4">
                <div>
                  <div className="micro-label">Rated capacity</div>
                  <div className="mt-1 text-sm font-semibold">{asset.capacity}</div>
                </div>
                <div>
                  <div className="micro-label">
                    {latest ? `Simulated hour ${latest.hour}` : "Configured state / observation"}
                  </div>
                  <div className="mt-1 text-sm font-semibold">{asset.available}</div>
                </div>
                <div>
                  <div className="micro-label">Modeled constraint</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    {asset.constraint}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="panel border-primary/25 bg-primary/5 p-5">
        <p className="text-xs leading-5 text-muted-foreground">
          Solar, wind, and generator measurements come directly from the selected telemetry hour.
        </p>
        {!hasRun && (
          <Button asChild variant="outline" className="mt-3">
            <Link to="/scenario-simulator">
              Create a run <ArrowRight size={14} />
            </Link>
          </Button>
        )}
      </div>
    </>
  );
}
