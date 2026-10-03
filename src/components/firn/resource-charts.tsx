import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TelemetryPoint } from "@/lib/firn-api";
import { energyRow, numberLabel } from "@/lib/operations-metrics";

const axis = { fill: "var(--muted-foreground)", fontSize: 11 };
const tooltip = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

/** All panels use the same numeric time domain; no independently normalized timelines. */
export function ResourceCharts({
  points,
  reserve,
  arrival,
  compact = false,
}: {
  points: TelemetryPoint[];
  reserve: number;
  arrival?: number | null | undefined;
  compact?: boolean;
}) {
  const data = points.map(energyRow);
  const domain: [number, number] =
    data.length > 1 ? [data[0]!.hour, data[data.length - 1]!.hour] : [0, 1];
  const specs: Array<{ title: string; unit: string; keys: Array<[string, string, string]> }> = [
    {
      title: "Power balance",
      unit: "kW",
      keys: [
        ["supply_kw", "Total supply", "var(--primary)"],
        ["demand_kw", "Demand", "var(--warning)"],
        ["renewable_kw", "Renewables", "var(--success)"],
      ],
    },
    { title: "Battery reserve", unit: "kWh", keys: [["battery_kwh", "Battery", "var(--warning)"]] },
    { title: "Fuel inventory", unit: "L", keys: [["fuel_liters", "Fuel", "var(--primary)"]] },
  ];
  if (data.length < 2)
    return (
      <div className="rounded border border-border p-4 text-sm text-muted-foreground">
        {data.length === 0 ? "No observations in this view." : "One observation is not a trend."}{" "}
        Advance the operating clock to inspect history, or choose the projected case.
      </div>
    );
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {specs.map((spec, index) => (
        <section
          key={spec.title}
          aria-label={spec.title}
          className={`rounded-lg border border-border bg-secondary/15 p-3 ${index === 0 ? "md:col-span-2" : ""}`}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <h3 className="font-semibold">{spec.title}</h3>
            <span className="text-muted-foreground">
              {spec.keys.map(([, label]) => label).join(" / ")} · {spec.unit}
            </span>
          </div>
          <div style={{ height: compact ? (index === 0 ? 140 : 105) : 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 7, right: 14, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
                <XAxis
                  type="number"
                  dataKey="hour"
                  allowDecimals={false}
                  domain={domain}
                  tick={axis}
                  tickFormatter={(h) => `H${h}`}
                  minTickGap={35}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={axis}
                  width={45}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  contentStyle={tooltip}
                  labelFormatter={(h) => `Hour ${h}`}
                  formatter={(value, name) => [`${numberLabel(value)} ${spec.unit}`, name]}
                />
                {index === 1 && (
                  <ReferenceLine
                    y={reserve}
                    stroke="var(--destructive)"
                    strokeDasharray="4 4"
                    label={{
                      value: `Reserve ${reserve}`,
                      fill: "var(--destructive)",
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                )}
                {typeof arrival === "number" && arrival >= domain[0] && arrival <= domain[1] && (
                  <ReferenceLine
                    x={arrival}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="3 4"
                    label={{
                      value: "Resupply",
                      fill: "var(--muted-foreground)",
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                )}
                {spec.keys.map(([key, label, color]) => (
                  <Line
                    key={key}
                    dataKey={key}
                    name={label}
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    strokeDasharray={key === "demand_kw" ? "5 3" : "0"}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      ))}
    </div>
  );
}

export function ResourceTable({ points }: { points: TelemetryPoint[] }) {
  return (
    <details className="mt-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer py-2 font-semibold text-primary">
        Inspect hourly values & supply components
      </summary>
      <div className="mt-2 max-h-64 overflow-auto rounded border border-border">
        <table className="w-full whitespace-nowrap text-right">
          <caption className="p-2 text-left">
            Supply = renewables + generators + battery discharge. Charging and curtailment are
            additional sinks.
          </caption>
          <thead className="sticky top-0 bg-background">
            <tr>
              {[
                "Hour",
                "Demand kW",
                "Supply kW",
                "Renewables kW",
                "Generators kW",
                "Discharge kW",
                "Charge kW",
                "Battery kWh",
                "Fuel L",
              ].map((h) => (
                <th key={h} className="p-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map(energyRow).map((p) => (
              <tr key={p.hour} className="border-t border-border">
                <th className="p-2">H{p.hour}</th>
                {[
                  p.demand_kw,
                  p.supply_kw,
                  p.renewable_kw,
                  p.generator_kw,
                  p.discharge_kw,
                  p.battery_charge_kw,
                  p.battery_kwh,
                  p.fuel_liters,
                ].map((v, i) => (
                  <td key={i} className="p-2">
                    {numberLabel(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
