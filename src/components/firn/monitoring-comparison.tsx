import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonitoringSession, PlanVersion, TelemetryPoint } from "@/lib/firn-api";
import { comparisonRows } from "@/lib/monitoring-model";
import { numberLabel } from "@/lib/operations-metrics";

/** Saved run observations only through the operator's cursor; never reveal future actuals. */
export function MonitoringComparison({
  points,
  plan,
  session,
}: {
  points: TelemetryPoint[];
  plan: PlanVersion;
  session: MonitoringSession;
}) {
  const data = comparisonRows(points, plan, session);
  if (!data.length)
    return (
      <div className="mt-4 rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Awaiting the first observation. Advancing the clock reveals saved hourly state—not a live
        hardware feed.
      </div>
    );
  const metrics = [
    {
      title: "Renewable availability",
      unit: "kW",
      actual: "renewable_kw",
      planned: "planned_renewable",
    },
    { title: "Battery reserve", unit: "kWh", actual: "battery_kwh", planned: "planned_battery" },
    { title: "Fuel inventory", unit: "L", actual: "fuel_liters", planned: "planned_fuel" },
  ];
  if (data.length === 1) {
    const point = data[0]!;
    const values = [
      ["Renewable availability", point.renewable_kw, point.planned_renewable, "kW"],
      ["Battery", point.battery_kwh, point.planned_battery, "kWh"],
      ["Fuel", point.fuel_liters, point.planned_fuel, "L"],
    ] as const;
    return (
      <section className="panel mt-4 p-4">
        <h3 className="text-sm font-semibold">Current observation · H{point.hour}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          One observation is not a trend. Advance the clock to build history.
        </p>
        <div className="mt-3 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Observed</th>
                <th>Proposal reference</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              {values.map(([name, actual, expected, unit]) => (
                <tr key={name} className="border-t border-border">
                  <th className="py-3">{name}</th>
                  <td>
                    {numberLabel(actual)} {unit}
                  </td>
                  <td>
                    {numberLabel(expected)} {unit}
                  </td>
                  <td>
                    {numberLabel(typeof expected === "number" ? actual - expected : null)} {unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Reference uses proposal assumptions; a difference alone does not establish an execution
          failure.
        </p>
      </section>
    );
  }
  return (
    <div className="mt-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Observed state / proposal reference</h3>
        <span className="text-xs text-muted-foreground">
          H0–H{session.current_hour} · monitored plan v{plan.version_number}
        </span>
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        {metrics.map((metric) => (
          <section
            key={metric.actual}
            className="min-w-0 rounded border border-border bg-secondary/20 p-3"
            aria-label={`${metric.title} observed versus plan`}
          >
            <div className="mb-2 flex justify-between text-xs">
              <span>{metric.title}</span>
              <span className="text-muted-foreground">{metric.unit}</span>
            </div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data}
                  syncId={`monitor-${session.id}`}
                  margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                >
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    type="number"
                    domain={[data[0]!.hour, data.at(-1)!.hour]}
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    minTickGap={24}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                  <Tooltip
                    labelFormatter={(hour) => `Simulated hour ${hour}`}
                    contentStyle={{
                      background: "var(--popover)",
                      borderColor: "var(--border)",
                      fontSize: 11,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line
                    dataKey={metric.actual}
                    name="Observed replay"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={data.length === 1}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey={metric.planned}
                    name="Plan"
                    stroke="var(--warning)"
                    strokeDasharray="5 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                  {Array.from(new Set(session.events.map((event) => event.hour))).map((hour) => (
                    <ReferenceLine
                      key={hour}
                      x={hour}
                      stroke="var(--destructive)"
                      strokeDasharray="2 4"
                    />
                  ))}
                  {(session.plan_origin_hour ?? 0) > 0 && (
                    <ReferenceLine
                      x={session.plan_origin_hour!}
                      stroke="var(--primary)"
                      label="Revision"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        ))}
      </div>
      <details className="text-[11px] text-muted-foreground">
        <summary className="cursor-pointer">Comparison basis & execution boundary</summary>
        <p className="mt-2">
          Dashed amber: proposal reference, beginning at its absolute time origin. Solid cyan:
          observed model state. Red markers: recorded events, not necessarily active alerts.
          {session.execution_policy === "generator_first_approved_missions_v1"
            ? " After operator activation, the simulator carries resources forward and applies the approved remaining mission schedule with generator-first dispatch. It does not execute MILP dispatch."
            : " Original-case replay does not execute optimizer dispatch; differences are not by themselves execution failures."}
        </p>
      </details>
    </div>
  );
}
