import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { getCaseOutlook } from "@/lib/firn-api";
import { useOperatingWorkspace } from "@/lib/use-operating-workspace";
import { numberLabel } from "@/lib/operations-metrics";
import { ResourceCharts, ResourceTable } from "./resource-charts";

export function LookAheadWorkspace() {
  const ws = useOperatingWorkspace();
  const [selected, setSelected] = useState("nominal");
  const origin = ws.cursor.hour ?? 0;
  const query = useQuery({
    queryKey: ["firn", "outlook", ws.run?.id, origin, ws.session?.id, ws.session?.plan_version_id],
    queryFn: () =>
      getCaseOutlook(ws.run!.id, origin, ws.cursor.observed ? ws.session?.id : undefined),
    enabled: !!ws.run && !ws.error && !ws.loading,
    retry: false,
    staleTime: 60_000,
  });
  const data = query.data;
  const scenario = data?.cases.find((c) => c.name === selected);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="micro-label text-primary">Forecast & alternatives</p>
          <h1 className="mt-1 text-2xl font-bold">Look ahead</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Examine resource exposure before selecting a planning policy.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/mission-planner">Open joint planner</Link>
        </Button>
      </div>
      {!ws.run && !ws.loading && (
        <div className="panel p-5">
          Select a case in{" "}
          <Link className="text-primary underline" to="/scenario-simulator">
            Scenario Simulator
          </Link>{" "}
          first.
        </div>
      )}
      {(ws.loading || query.isFetching) && (
        <p role="status" className="panel p-5">
          Computing saved-case alternatives…
        </p>
      )}
      {(ws.error || query.error) && (
        <div role="alert" className="panel p-4 text-destructive">
          {ws.error ?? (query.error instanceof Error ? query.error.message : "Outlook unavailable")}
          <Button
            className="ml-3"
            variant="outline"
            onClick={() => {
              ws.refresh();
              void query.refetch();
            }}
          >
            Retry outlook
          </Button>
        </div>
      )}
      {data && !query.isFetching && !query.isError && ws.run && (
        <>
          <section className="panel p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Matched-start resource alternatives</h2>
              <div className="flex flex-wrap gap-2">
                {data.cases.map((c) => (
                  <Button
                    key={c.name}
                    size="sm"
                    variant={selected === c.name ? "default" : "outline"}
                    onClick={() => setSelected(c.name)}
                  >
                    {c.name === "low_renewable"
                      ? "Adverse renewable"
                      : c.name === "storm"
                        ? "Storm"
                        : "Nominal"}
                  </Button>
                ))}
              </div>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Same starting resources, station, seed, disruptions and resupply. Full{" "}
              {ws.run.duration_days}-day alternatives—not current-state forecasts or probability
              intervals.
            </p>
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              {data.cases.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setSelected(c.name)}
                  aria-pressed={selected === c.name}
                  className={`rounded-lg border p-4 text-left ${selected === c.name ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <h3 className="text-sm font-semibold capitalize">
                    {c.name.replaceAll("_", " ")}
                  </h3>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <span>
                      Min battery
                      <br />
                      <strong className="text-foreground">
                        {numberLabel(c.summary.battery_min_kwh)} kWh
                      </strong>
                    </span>
                    <span>
                      End fuel
                      <br />
                      <strong className="text-foreground">
                        {numberLabel(c.summary.fuel_remaining_liters, 0)} L
                      </strong>
                    </span>
                    <span>
                      Completed
                      <br />
                      <strong className="text-foreground">
                        {c.summary.missions_completed} missions
                      </strong>
                    </span>
                    <span>
                      Critical shortfall
                      <br />
                      <strong
                        className={
                          c.summary.critical_violation_hours
                            ? "text-destructive"
                            : "text-foreground"
                        }
                      >
                        {c.summary.critical_violation_hours} h
                      </strong>
                    </span>
                  </div>
                </button>
              ))}
            </div>
            {scenario && (
              <>
                <p className="mb-3 text-xs text-muted-foreground">{scenario.description}</p>
                <ResourceCharts
                  points={scenario.telemetry}
                  reserve={ws.run.config_snapshot.station.battery.reserve_kwh}
                  arrival={scenario.telemetry[0]?.resupply_arrival_hour}
                />
                <ResourceTable points={scenario.telemetry} />
              </>
            )}
          </section>
          <section className="panel p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="font-semibold">24-hour numeric baseline</h2>
              <span className="text-xs text-muted-foreground">
                Origin H{data.origin_hour} · {data.forecast.method.replaceAll("_", " ")} ·{" "}
                {data.forecast.training_hours} observations
              </span>
            </div>
            <p className="my-3 text-xs text-muted-foreground">
              Only observations through the operating cursor are used. At H0, persistence repeats
              the opening reading; it is not a learned weather forecast.
            </p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.forecast.points} margin={{ right: 18, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(h) => `H${h}`}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  />
                  <YAxis width={45} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                    }}
                    labelFormatter={(h) => `Hour ${h}`}
                    formatter={(v, name) => [`${numberLabel(v)} kW`, name]}
                  />
                  <Line
                    dataKey="demand_kw"
                    name="Forecast demand"
                    stroke="var(--warning)"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="renewable_kw"
                    name="Forecast renewables"
                    stroke="var(--primary)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-primary">
                Forecast values & assumptions
              </summary>
              <div className="mt-3 max-h-48 overflow-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th>Hour</th>
                      <th>Demand kW</th>
                      <th>Renewables kW</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.forecast.points.map((p) => (
                      <tr key={p.hour}>
                        <td>H{p.hour}</td>
                        <td>{numberLabel(p.demand_kw)}</td>
                        <td>{numberLabel(p.renewable_kw)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-muted-foreground">
                {String(data.assumptions["forecast_basis"])}{" "}
                {String(data.assumptions["scenario_model"])}. No calibrated probabilities. Config
                fingerprint: {data.config_fingerprint.slice(0, 16)}.
              </p>
            </details>
          </section>
        </>
      )}
    </div>
  );
}
