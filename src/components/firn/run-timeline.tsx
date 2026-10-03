import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TelemetryPoint } from "@/lib/firn-api";
import { useFirn } from "@/lib/firn-context";
import { formatRecordTime } from "@/lib/workspace-model";
import { energyRow } from "@/lib/operations-metrics";
import { ResourceTable } from "./resource-charts";

const axis = { fill: "var(--muted-foreground)", fontSize: 10 };
const tooltip = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--foreground)",
  fontSize: 11,
};

export function RunTimeline({ points }: { points: TelemetryPoint[] }) {
  const { preferences, motionReduced } = useFirn();
  const data = points.map((point) => ({
    ...energyRow(point),
    timeLabel: `H${point.hour}`,
  }));
  const interval = Math.max(1, Math.floor(data.length / 8));
  const chartProps = { data, margin: { top: 8, right: 12, left: -18, bottom: 2 } };
  if (data.length < 2)
    return (
      <div role="status" className="rounded border border-border p-4 text-sm text-muted-foreground">
        {data.length
          ? "One observation is available; a trend requires the next hour."
          : "No observations available yet."}{" "}
        Current readings remain above. Advance the operating clock to reveal history.
      </div>
    );
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <TimelinePanel title="Supply vs station demand" unit="kW">
        <LineChart {...chartProps}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
          <XAxis
            dataKey="timeLabel"
            tick={axis}
            axisLine={false}
            tickLine={false}
            interval={interval}
          />
          <YAxis tick={axis} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={tooltip}
            labelFormatter={(_, rows) =>
              formatRecordTime(rows[0]?.payload?.timestamp, preferences.timezone)
            }
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line
            dataKey="supply_kw"
            name="Total supply"
            stroke="var(--primary)"
            dot={false}
            strokeWidth={2}
            isAnimationActive={!motionReduced}
          />
          <Line
            type="monotone"
            dataKey="renewable_kw"
            isAnimationActive={!motionReduced}
            name="Renewable"
            stroke="var(--warning)"
            dot={data.length === 1}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="demand_kw"
            isAnimationActive={!motionReduced}
            name="Demand"
            stroke="var(--success)"
            dot={data.length === 1}
            strokeWidth={2}
          />
        </LineChart>
      </TimelinePanel>
      <TimelinePanel title="Battery state of charge" unit="kWh">
        <AreaChart {...chartProps}>
          <defs>
            <linearGradient id="battery-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--warning)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
          <XAxis
            dataKey="timeLabel"
            tick={axis}
            axisLine={false}
            tickLine={false}
            interval={interval}
          />
          <YAxis tick={axis} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={tooltip}
            labelFormatter={(_, rows) =>
              formatRecordTime(rows[0]?.payload?.timestamp, preferences.timezone)
            }
          />
          <Area
            type="monotone"
            dataKey="battery_kwh"
            isAnimationActive={!motionReduced}
            name="Battery"
            stroke="var(--warning)"
            fill="url(#battery-fill)"
            dot={data.length === 1}
            strokeWidth={2}
          />
        </AreaChart>
      </TimelinePanel>
      <TimelinePanel title="Fuel inventory" unit="L">
        <LineChart {...chartProps}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
          <XAxis
            dataKey="timeLabel"
            tick={axis}
            axisLine={false}
            tickLine={false}
            interval={interval}
          />
          <YAxis tick={axis} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={tooltip}
            labelFormatter={(_, rows) =>
              formatRecordTime(rows[0]?.payload?.timestamp, preferences.timezone)
            }
          />
          <Line
            type="monotone"
            dataKey="fuel_liters"
            isAnimationActive={!motionReduced}
            name="Fuel"
            stroke="var(--primary)"
            dot={data.length === 1}
            strokeWidth={2}
          />
        </LineChart>
      </TimelinePanel>
      <div className="xl:col-span-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="micro-label">Weather regime · same hourly horizon</span>
          <span className="text-[9px] text-muted-foreground">Each segment = 1 simulated hour</span>
        </div>
        <div
          className="flex h-3 w-full overflow-hidden rounded-sm bg-secondary"
          role="img"
          aria-label="Weather regime timeline"
        >
          {data.map((point) => (
            <span
              key={point.hour}
              title={`Hour ${point.hour}: ${point.weather_regime ?? "not recorded"}`}
              className={`h-full flex-1 ${weatherColor(point.weather_regime)}`}
            />
          ))}
        </div>
        <div className="mt-1 flex gap-3 text-[9px] text-muted-foreground">
          <span>
            <i className="mr-1 inline-block size-2 rounded-sm bg-primary" />
            Clear / nominal
          </span>
          <span>
            <i className="mr-1 inline-block size-2 rounded-sm bg-warning" />
            Cloudy
          </span>
          <span>
            <i className="mr-1 inline-block size-2 rounded-sm bg-destructive" />
            Storm
          </span>
        </div>
      </div>
      <details className="text-[10px] leading-4 text-muted-foreground xl:col-span-3">
        <summary className="cursor-pointer">Trajectory assumptions</summary>
        <p className="mt-2">
          Saved station-model output, not live telemetry. Weather colors show model regimes, not
          probabilities.
        </p>
      </details>
      <div className="xl:col-span-3">
        <ResourceTable points={points} />
      </div>
    </div>
  );
}

function TimelinePanel({
  title,
  unit,
  children,
}: {
  title: string;
  unit: string;
  children: React.ReactElement;
}) {
  return (
    <div className="rounded border border-border bg-secondary/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold">{title}</h3>
        <span className="micro-label">{unit}</span>
      </div>
      <div className="h-[190px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function weatherColor(regime?: string) {
  if (regime === "storm") return "bg-destructive";
  if (regime === "cloudy") return "bg-warning";
  if (regime === "clear") return "bg-primary";
  return "bg-muted-foreground/30";
}
