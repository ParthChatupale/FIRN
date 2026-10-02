import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  BatteryCharging,
  CircleAlert,
  CloudSnow,
  Fuel,
  LoaderCircle,
  Play,
  ShieldCheck,
  Wind,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PageHeader,
  ReasonButton,
  ScenarioChip,
  SectionTitle,
  StatusBadge,
} from "@/components/firn/shell";
import { useFirn } from "@/lib/firn-context";
import type { ScenarioId } from "@/lib/firn-data";
import {
  createSimulationRun,
  getApiHealth,
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
          "Test simulated storms, asset failures, fuel delays and battery constraints in FIRN.",
      },
      { property: "og:title", content: "Scenario Simulator — FIRN" },
      {
        property: "og:description",
        content: "See how FIRN adapts polar missions and energy allocation together.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Simulator,
});
function Simulator() {
  const { scenario, scenarioId } = useFirn();
  const [days, setDays] = useState(30);
  const [seed, setSeed] = useState(42);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [savedRun, setSavedRun] = useState<SimulationRun | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  useEffect(() => {
    getApiHealth()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
  }, []);
  const changed = scenarioId !== "normal";
  const response =
    scenarioId === "storm"
      ? [
          ["Experiment A", "MOVED EARLIER"],
          ["Experiment B", "DEFERRED"],
          ["Sample Processing", "RUN"],
          ["Water Production", "PROTECTED"],
          ["Battery", "RESERVE PROTECTED"],
          ["Generator", "READY"],
          ["Fuel", "CONSERVE"],
        ]
      : scenario.actions.map((a, i) => [
          ["Action 01", "Action 02", "Action 03", "Action 04", "Action 05"][i],
          a,
        ]);
  const apiScenarios: Record<ScenarioId, ApiScenario> = {
    normal: "normal",
    storm: "storm",
    generator: "generator_failure",
    fuel: "resupply_delay",
    battery: "battery_capacity_loss",
  };
  async function runSimulation() {
    setRunning(true);
    setRunError(null);
    setSavedRun(null);
    setTelemetry([]);
    try {
      const created = await createSimulationRun({ scenario: apiScenarios[scenarioId], days, seed });
      const [retrieved, page] = await Promise.all([
        getSimulationRun(created.id),
        getSimulationTelemetry(created.id, 24),
      ]);
      setSavedRun(retrieved);
      setTelemetry(page.items);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Simulation failed. Please retry.");
    } finally {
      setRunning(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Operational intelligence / What-if analysis"
        title="Scenario Simulator"
        description="Execute a station scenario, save its results, and inspect the resulting resource trajectory."
        action={
          <span className="flex items-center gap-2 text-[11px] uppercase tracking-[.1em] text-muted-foreground">
            <span
              className={`size-2 rounded-full ${apiOnline ? "bg-success" : apiOnline === false ? "bg-destructive" : "bg-warning"}`}
            />
            {apiOnline
              ? "API · DATABASE ONLINE"
              : apiOnline === false
                ? "API OFFLINE"
                : "CHECKING API"}
          </span>
        }
      />
      <div className="panel mb-5 p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="micro-label text-primary">01 / Select a condition</div>
            <h2 className="mt-1 font-display text-base font-bold">Station scenario</h2>
          </div>
          <div className="hidden text-[11px] text-muted-foreground md:block">
            Select the scenario to execute below
          </div>
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
            <div className="micro-label text-primary">02 / Execute with the simulation engine</div>
            <h2 className="mt-1 font-display text-base font-bold">Run and save scenario</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The API executes this scenario and stores its results and hourly telemetry in
              PostgreSQL.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="w-28 text-xs text-muted-foreground">
              Duration (days)
              <Input
                aria-label="Duration in days"
                type="number"
                min={2}
                max={365}
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
                className="mt-1"
              />
            </label>
            <label className="w-28 text-xs text-muted-foreground">
              Random seed
              <Input
                aria-label="Random seed"
                type="number"
                value={seed}
                onChange={(event) => setSeed(Number(event.target.value))}
                className="mt-1"
              />
            </label>
            <Button
              onClick={runSimulation}
              disabled={
                running ||
                !Number.isInteger(days) ||
                days < 2 ||
                days > 365 ||
                !Number.isSafeInteger(seed)
              }
              className="min-w-40"
            >
              {running ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play />
                  Run simulation
                </>
              )}
            </Button>
          </div>
        </div>
        {runError && (
          <div
            role="alert"
            className="mt-4 rounded border border-destructive/35 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {runError}
          </div>
        )}
        {savedRun && (
          <div className="mt-6 border-t border-border pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="micro-label text-success">Saved run / Retrieved from API</div>
                <h3 className="mt-1 font-display text-lg font-bold">
                  {savedRun.scenario.replaceAll("_", " ")}
                </h3>
              </div>
              <StatusBadge tone="good">POSTGRESQL · {savedRun.simulator_version}</StatusBadge>
            </div>
            <p className="mt-1 break-all text-[11px] text-muted-foreground">
              Run ID: {savedRun.id} · {savedRun.duration_days} days · seed {savedRun.seed}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <RunMetric
                label="Missions completed"
                value={`${savedRun.summary.missions_completed}`}
                note={`${savedRun.summary.missions_failed} failed`}
              />
              <RunMetric
                label="Renewable share"
                value={`${savedRun.summary.renewable_share_percent}%`}
                note="of served energy"
              />
              <RunMetric
                label="Battery"
                value={`${savedRun.summary.battery_final_kwh} kWh`}
                note={`minimum ${savedRun.summary.battery_min_kwh} kWh`}
              />
              <RunMetric
                label="Fuel remaining"
                value={`${savedRun.summary.fuel_remaining_liters} L`}
                note="at run end"
              />
              <RunMetric
                label="Critical violations"
                value={`${savedRun.summary.critical_violation_hours} h`}
                note={`${savedRun.summary.unserved_energy_kwh} kWh unserved`}
              />
            </div>
            <div className="mt-5 overflow-x-auto rounded border border-border">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead className="bg-secondary/40 text-[10px] uppercase tracking-[.1em] text-muted-foreground">
                  <tr>
                    {["Hour", "Battery SOC", "Renewables", "Demand", "Fuel"].map((label) => (
                      <th key={label} className="px-3 py-2 font-semibold">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {telemetry
                    .filter((point) => point.hour % 6 === 0)
                    .map((point) => (
                      <tr key={point.hour} className="border-t border-border/60">
                        <td className="px-3 py-2">{point.hour}</td>
                        <td className="px-3 py-2">{point.battery_soc_percent}%</td>
                        <td className="px-3 py-2">{point.renewable_kw} kW</td>
                        <td className="px-3 py-2">{point.demand_kw} kW</td>
                        <td className="px-3 py-2">{point.fuel_liters} L</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Hourly samples shown for the first simulated day. All{" "}
              {savedRun.summary.duration_hours} hourly records are persisted and available from the
              API.
            </p>
          </div>
        )}
      </div>
      <div
        className={`mb-5 flex flex-col gap-4 rounded-md border p-5 transition-colors md:flex-row md:items-center md:justify-between md:p-6 ${changed ? "border-warning/35 bg-warning/5" : "border-success/30 bg-success/5"}`}
      >
        <div className="flex gap-3">
          <div className={`mt-0.5 ${changed ? "text-warning" : "text-success"}`}>
            {changed ? <CircleAlert size={23} /> : <ShieldCheck size={23} />}
          </div>
          <div>
            <div className={`micro-label ${changed ? "text-warning" : "text-success"}`}>
              {scenario.label} / selected scenario context
            </div>
            <h2 className="mt-1 font-display text-xl font-bold">{scenario.headline}</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground md:text-[13px]">
              {scenario.message}
            </p>
          </div>
        </div>
        <StatusBadge tone={changed ? "warn" : "good"}>
          {changed ? "SCENARIO SELECTED" : "BASELINE SELECTED"}
        </StatusBadge>
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <div className="panel p-5 md:p-6">
          <SectionTitle aside="Reference context">Condition changes</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {[
              [
                CloudSnow,
                "TEMPERATURE",
                scenario.temperature,
                scenarioId === "storm" ? "−3°C vs baseline" : "Station exterior",
              ],
              [
                Wind,
                "WIND SPEED",
                scenario.wind,
                scenarioId === "storm" ? "+26 km/h vs baseline" : "Within operating range",
              ],
              [
                Zap,
                "RENEWABLES",
                `${scenario.solar + scenario.windPower} kW`,
                `${scenario.solar} solar + ${scenario.windPower} wind`,
              ],
              [
                BatteryCharging,
                "BATTERY SOC",
                `${scenario.battery}%`,
                scenarioId === "battery" ? "Usable capacity −30%" : "Reserve threshold 30%",
              ],
            ].map(([Icon, label, value, note]) => {
              const I = Icon as typeof Zap;
              return (
                <div
                  key={label as string}
                  className="rounded border border-border bg-secondary/30 p-4"
                >
                  <I size={17} className="text-primary" />
                  <div className="micro-label mt-3">{label as string}</div>
                  <div className="mt-1 font-display text-2xl font-bold">{value as string}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{note as string}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded border border-border bg-secondary/30 p-3">
              <div className="micro-label">Visibility / Weather Risk</div>
              <div className="mt-1 text-sm font-semibold">
                {scenario.visibility} <span className="text-warning">· {scenario.risk}</span>
              </div>
            </div>
            <div className="rounded border border-border bg-secondary/30 p-3">
              <div className="micro-label">Fuel reserve</div>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
                <Fuel size={14} className="text-primary" />
                {scenario.fuel}
              </div>
            </div>
          </div>
        </div>
        <div className="panel border-primary/30 bg-primary/5 p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="micro-label text-primary">Scenario context / reference response</div>
              <h2 className="mt-1 font-display text-lg font-bold">Operating response</h2>
            </div>
            <span className="text-[11px] text-muted-foreground">Mission + Energy + Assets</span>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {changed
              ? "These interface reference actions are illustrative. The persisted simulator executes configured missions and dispatch policy; it does not yet optimize or replan a schedule."
              : "Reference operating actions are shown here. Run the scenario above to inspect calculated and persisted simulation results."}
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {changed
              ? response.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex min-h-12 items-center justify-between gap-2 rounded border border-border bg-background/40 px-3 py-2"
                  >
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-right text-[10px] font-bold uppercase text-primary">
                      {value}
                    </span>
                  </div>
                ))
              : [
                  ["Experiment A", "CONTINUE"],
                  ["Experiment B", "SCHEDULED"],
                  ["Water Production", "PROTECTED"],
                  ["Battery", "RESERVE HEALTHY"],
                  ["Generator", "STANDBY"],
                  ["Fuel", "CONSERVE"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex min-h-12 items-center justify-between gap-2 rounded border border-border bg-background/40 px-3 py-2"
                  >
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-[10px] font-bold text-success">{value}</span>
                  </div>
                ))}
          </div>
          <div className="mt-5">
            <ReasonButton />
          </div>
        </div>
      </div>
      <div className="panel p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="micro-label text-primary">Planning concept / reference only</div>
            <h2 className="mt-1 font-display text-lg font-bold">Illustrative plan comparison</h2>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {changed ? scenario.label : "Select a disruption to compare outcomes"}
          </span>
        </div>
        <div className="mt-5 grid items-stretch gap-3 md:grid-cols-[1fr_42px_1fr]">
          <Comparison
            title="BEFORE STORM"
            accent={false}
            rows={[
              "Experiment A → 10:00",
              "Experiment B → 14:00",
              "Battery → 74%",
              "Generator → Standby",
            ]}
          />
          <div className="flex items-center justify-center text-primary">
            <ArrowRight className="hidden md:block" size={23} />
            <ArrowDownRight className="md:hidden" size={23} />
          </div>
          <Comparison
            title={changed ? "AFTER FIRN REPLAN" : "CURRENT OPERATING PLAN"}
            accent
            rows={
              changed
                ? scenarioId === "storm"
                  ? [
                      "Experiment A → 09:00",
                      "Experiment B → Deferred 6 hrs",
                      "Battery → Reserve protected",
                      "Generator → Ready for critical loads",
                    ]
                  : scenario.actions.slice(0, 4)
                : [
                    "Experiment A → 10:00",
                    "Experiment B → 14:00",
                    "Battery → 74%",
                    "Generator → Standby",
                  ]
            }
          />
        </div>
        <div className="mt-5 rounded border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-xs font-bold">
            <ShieldCheck size={16} className="text-primary" /> Scenario rationale
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {scenarioId === "storm"
              ? "The selected storm input reduces renewable output during the event window. Review the saved run metrics and telemetry above for the engine-calculated effects."
              : changed
                ? `${scenario.message} The computed simulation outcome is shown in the saved run panel above.`
                : "No disruption is active. Run the baseline scenario to view its calculated resource trajectory."}
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground">
            This comparison is not generated by the persisted simulation run. The run panel above
            displays outputs calculated by the current engine.
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="micro-label">SENSE → PREDICT → OPTIMIZE → ADAPT → EXPLAIN</div>
        <Button asChild variant="outline" className="bg-secondary/40">
          <Link to="/decision-log">
            View Decision Log <ArrowRight size={14} />
          </Link>
        </Button>
      </div>
    </>
  );
}
function Comparison({ title, accent, rows }: { title: string; accent: boolean; rows: string[] }) {
  return (
    <div
      className={`rounded border p-4 md:p-5 ${accent ? "border-primary/35 bg-primary/5" : "border-border bg-secondary/25"}`}
    >
      <div className={`micro-label ${accent ? "text-primary" : ""}`}>{title}</div>
      <div className="mt-4 space-y-3">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex min-h-8 items-center border-b border-border/60 pb-2 text-xs last:border-0 last:pb-0"
          >
            {row}
          </div>
        ))}
      </div>
    </div>
  );
}

function RunMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded border border-border bg-secondary/25 p-3">
      <div className="micro-label">{label}</div>
      <div className="mt-2 font-display text-xl font-bold">{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">{note}</div>
    </div>
  );
}
