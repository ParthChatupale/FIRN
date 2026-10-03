import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  BatteryMedium,
  Fuel,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/firn/shell";
import { useOperatingWorkspace } from "@/lib/use-operating-workspace";
import { useFirn } from "@/lib/firn-context";
import type { PlanVersion } from "@/lib/firn-api";
import { formatUtc } from "@/lib/display";

type Workspace = ReturnType<typeof useOperatingWorkspace>;
const axis = { fill: "var(--muted-foreground)", fontSize: 11 };
const tooltip = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 12,
};
const postureLabels = {
  stable: "No current exceptions",
  setup: "Plan required",
  unobserved: "Awaiting observation",
  watch: "Watch",
  action: "Action required",
};
const postureTone = {
  stable: "good",
  setup: "neutral",
  unobserved: "neutral",
  watch: "warn",
  action: "critical",
} as const;

export function OperationsCenter() {
  const workspace = useOperatingWorkspace();
  const { reviewHour, setReviewHour, setCaseLibraryOpen } = useFirn();
  const [span, setSpan] = useState(72);
  if (workspace.loading)
    return (
      <WorkspaceState
        title="Loading operating picture"
        copy="Retrieving the selected case, plan, and clock."
      />
    );
  if (workspace.error)
    return (
      <WorkspaceState
        title="Operating picture unavailable"
        copy={workspace.error}
        retry={workspace.refresh}
      />
    );
  if (!workspace.run)
    return (
      <WorkspaceState
        title="Open an operating case"
        copy="Open saved station evidence to review energy, reserve, mission timing, and the next operator decision."
      />
    );
  const run = workspace.run;
  const s = workspace.snapshot;
  const activePlan = s.activePlan;
  const reference = s.referencePlan;
  // Checkpoint proposals have a new time origin; never overlay them onto the original clock.
  const alignedPlan =
    reference?.simulation_start_time === (run.config_snapshot.start_time ?? run.started_at)
      ? reference
      : null;
  const start = span === 0 ? 0 : Math.max(0, s.hour);
  const end =
    span === 0
      ? run.summary.duration_hours - 1
      : Math.min(run.summary.duration_hours - 1, start + span - 1);
  const casePoints = workspace.points.filter((point) => point.hour >= start && point.hour <= end);
  const chartData = alignedPlan?.plan_snapshot.dispatch?.length
    ? alignedPlan.plan_snapshot.dispatch
        .filter((point) => point.hour >= start && point.hour <= end)
        .map((point) => ({
          hour: point.hour,
          demand: finite(point.demand_kw),
          renewable: finite(point.renewable_used_kw),
          generator: point.generator_output_kw
            ? Object.values(point.generator_output_kw).reduce((a, b) => a + b, 0)
            : null,
          battery: finite(point.battery_soc_kwh),
          fuel: finite(point.fuel_liters),
        }))
    : casePoints.map((point) => ({
        hour: point.hour,
        demand: point.demand_kw,
        renewable: point.renewable_kw,
        generator: point.generator_output_kw
          ? Object.values(point.generator_output_kw).reduce((a, b) => a + b, 0)
          : null,
        battery: point.battery_kwh,
        fuel: point.fuel_liters,
      }));
  const progress = workspace.session?.latest_observation?.mission_progress;
  const schedule = reference?.plan_snapshot.schedule ?? [];
  const completed = progress?.filter(
    (mission) => mission["observed_state"] === "mission_completed",
  ).length;
  const planned = schedule.filter((mission) => mission.selected).length;
  const missionValue = progress
    ? `${completed} / ${progress.length}`
    : reference
      ? `${planned} / ${schedule.length}`
      : "—";
  const events = [...(workspace.session?.events ?? [])]
    .filter((event) => event.hour <= s.hour)
    .sort((a, b) => b.hour - a.hour)
    .slice(0, 3);
  const timestamp = formatUtc(s.timestamp);
  const runStart = Date.parse(run.config_snapshot.start_time ?? run.started_at);
  const caseEvents = workspace.runEvents
    .map((event, index) => ({
      event,
      index,
      hour:
        typeof event["timestamp"] === "string"
          ? Math.floor((Date.parse(event["timestamp"]) - runStart) / 3_600_000)
          : Number.NaN,
    }))
    .filter((item) => Number.isFinite(item.hour) && item.hour >= 0 && item.hour <= s.hour)
    .sort((a, b) => b.hour - a.hour)
    .slice(0, 3);
  return (
    <div className="operations-board">
      <div className="ops-title-row">
        <div>
          <div className="micro-label">Station command center</div>
          <h1>Operations</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <StatusBadge tone={postureTone[s.posture]}>{postureLabels[s.posture]}</StatusBadge>
          <Button variant="outline" size="sm" onClick={() => setCaseLibraryOpen(true)}>
            Open case
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={workspace.refresh}
            disabled={workspace.refreshing}
            aria-label="Refresh operating picture"
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>

      <section aria-label="Operating margins" className="ops-metrics">
        <Margin
          icon={Fuel}
          label="Fuel until resupply"
          value={s.fuel === null ? "—" : number(s.fuel)}
          unit={s.fuel === null ? "" : "L"}
          detail={
            s.resupplyHours === null
              ? "Delivery timing unavailable"
              : s.resupplyHours === 0
                ? "Delivery window elapsed"
                : `Delivery in ${duration(s.resupplyHours)}`
          }
          note={
            s.runway === null
              ? "Runway unavailable"
              : `${duration(s.runway)} runway at recent consumption`
          }
          tone={s.fuelPressure ? "warn" : "neutral"}
        />
        <Margin
          icon={BatteryMedium}
          label="Battery above reserve"
          value={s.margin === null ? "—" : number(s.margin)}
          unit={s.margin === null ? "" : "kWh"}
          detail={s.reserve === null ? "Reserve unavailable" : `${number(s.reserve)} kWh protected`}
          note={s.batteryKwh === null ? "State unavailable" : `${number(s.batteryKwh)} kWh stored`}
          tone={s.margin !== null && s.margin <= 0 ? "warn" : "neutral"}
        />
        <Margin
          icon={ShieldCheck}
          label="Critical service"
          value={s.critical === null ? "Unobserved" : s.critical ? "Shortfall" : "Served"}
          unit=""
          detail={
            s.critical === null
              ? "Awaiting a telemetry sample"
              : s.critical
                ? "Immediate review required"
                : "No shortfall at this hour"
          }
          note={s.clockLabel}
          tone={s.critical ? "critical" : s.critical === false ? "good" : "neutral"}
        />
        <Margin
          icon={Activity}
          label="Mission delivery"
          value={missionValue}
          unit=""
          detail={
            progress
              ? "Completed in playback"
              : reference
                ? "Selected in plan"
                : "No selected schedule"
          }
          note={
            reference
              ? `Plan v${reference.version_number} · ${reference.status}`
              : "Establish an operating plan"
          }
          tone="neutral"
        />
      </section>

      <div className="ops-workspace-grid">
        <section className="ops-panel ops-horizon" aria-label="Operating horizon">
          <div className="ops-panel-heading">
            <div>
              <h2>Energy & reserve horizon</h2>
              <p>
                {alignedPlan
                  ? `Plan v${alignedPlan.version_number} projection`
                  : "Saved case trajectory"}{" "}
                · H{start}–H{end}
              </p>
            </div>
            <div className="ops-range" role="group" aria-label="Chart horizon">
              {[24, 72, 0].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={span === value}
                  onClick={() => setSpan(value)}
                >
                  {value ? `${value}h` : "Full"}
                </button>
              ))}
            </div>
          </div>
          {chartData.length ? (
            <>
              <div
                className="ops-power-chart"
                role="img"
                aria-label={`Demand, renewable and generator power in kilowatts from hour ${start} to ${end}`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    syncId="operations-horizon"
                    margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="hour"
                      type="number"
                      domain={[start, end]}
                      tick={axis}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(hour) => `H${hour}`}
                      minTickGap={35}
                    />
                    <YAxis
                      tick={axis}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                      label={{
                        value: "kW",
                        angle: -90,
                        position: "insideLeft",
                        fill: "var(--muted-foreground)",
                        fontSize: 11,
                      }}
                    />
                    <Tooltip
                      contentStyle={tooltip}
                      labelFormatter={(hour) => `Operating hour ${hour}`}
                      formatter={chartNumber}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="plainline" />
                    <Line
                      type="linear"
                      dataKey="demand"
                      name="Demand"
                      stroke="var(--foreground)"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="linear"
                      dataKey="renewable"
                      name={alignedPlan ? "Renewable used" : "Renewable available"}
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="linear"
                      dataKey="generator"
                      name="Generators"
                      stroke="var(--ice)"
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                    {s.hour >= 0 && (
                      <ReferenceLine
                        x={s.hour}
                        stroke="var(--muted-foreground)"
                        strokeDasharray="3 3"
                      />
                    )}
                    {s.arrival !== null && s.arrival >= start && s.arrival <= end && (
                      <ReferenceLine
                        x={s.arrival}
                        stroke="var(--warning)"
                        strokeDasharray="4 4"
                        label={{
                          value: "Resupply",
                          fill: "var(--warning)",
                          position: "insideTopRight",
                          fontSize: 11,
                        }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="ops-reserve-grid">
                <ReserveChart
                  title="Battery energy"
                  unit="kWh"
                  data={chartData}
                  dataKey="battery"
                  reserve={s.reserve}
                  domain={[start, end]}
                />
                <ReserveChart
                  title="Fuel inventory"
                  unit="L"
                  data={chartData}
                  dataKey="fuel"
                  reserve={null}
                  domain={[start, end]}
                />
              </div>
            </>
          ) : (
            <p className="ops-empty">No aligned trajectory is available for this horizon.</p>
          )}
          <div className="ops-chart-caption">
            <span>
              {alignedPlan ? "Modeled dispatch" : "Precomputed case"} · {s.clockLabel} · {timestamp}
            </span>
            <span className="chart-basis">
              {alignedPlan ? "Plan projection · not observed dispatch" : "Saved trajectory"}
            </span>
          </div>
          <details className="ops-chart-data">
            <summary>View horizon values</summary>
            <div className="max-h-44 overflow-auto">
              <table>
                <caption className="sr-only">Energy and reserve horizon values</caption>
                <thead>
                  <tr>
                    <th>Hour</th>
                    <th>Demand kW</th>
                    <th>Renewable kW</th>
                    <th>Generator kW</th>
                    <th>Battery kWh</th>
                    <th>Fuel L</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row) => (
                    <tr key={row.hour}>
                      <td>H{row.hour}</td>
                      <td>{optionalNumber(row.demand)}</td>
                      <td>{optionalNumber(row.renewable)}</td>
                      <td>{optionalNumber(row.generator)}</td>
                      <td>{optionalNumber(row.battery)}</td>
                      <td>{optionalNumber(row.fuel)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <div className="ops-decision-column">
          <DecisionPanel workspace={workspace} />
          <section className="ops-panel ops-plan-panel">
            <div className="ops-panel-heading">
              <h2>{activePlan ? "Active mission schedule" : "Selected mission schedule"}</h2>
              {reference && (
                <StatusBadge tone={activePlan ? "good" : "warn"}>
                  v{reference.version_number} · {reference.status}
                </StatusBadge>
              )}
            </div>
            {schedule.length ? (
              <div className="ops-mission-list">
                {schedule.slice(0, 4).map((mission) => {
                  const config = run.config_snapshot.station?.missions.find(
                    (item) => item.id === mission.mission_id,
                  );
                  const startHour = mission.start_hour;
                  return (
                    <div key={mission.mission_id} className="ops-mission-row">
                      <span>{config?.name ?? humanize(mission.mission_id)}</span>
                      <span>
                        {mission.selected
                          ? `H${startHour ?? "—"} · ${mission.duration_hours ?? "—"}h`
                          : "Deferred"}
                      </span>
                      <div
                        className="ops-mission-track"
                        aria-label={
                          mission.selected
                            ? `Scheduled at hour ${startHour} for ${mission.duration_hours} hours`
                            : "Deferred"
                        }
                      >
                        {mission.selected &&
                          typeof startHour === "number" &&
                          startHour <= end &&
                          startHour + (mission.duration_hours ?? 0) > start && (
                            <span
                              style={{
                                left: `${Math.max(0, ((startHour - start) / (end - start + 1)) * 100)}%`,
                                width: `${Math.max(0, ((Math.min(end + 1, startHour + (mission.duration_hours ?? 0)) - Math.max(start, startHour)) / (end - start + 1)) * 100)}%`,
                              }}
                            />
                          )}
                      </div>
                    </div>
                  );
                })}
                <Link to="/plan" className="ops-link">
                  Inspect full schedule <ArrowRight size={13} />
                </Link>
              </div>
            ) : (
              <p className="ops-empty">
                Choose a proposal in Plan to inspect mission timing and resource trade-offs.
              </p>
            )}
          </section>
          <section className="ops-panel ops-attention-panel">
            <div className="ops-panel-heading">
              <h2>Attention & recent changes</h2>
              <span className="text-xs text-muted-foreground">
                {workspace.session ? events.length : caseEvents.length} records
              </span>
            </div>
            <div className="ops-event-list">
              {s.critical && (
                <div className="ops-event">
                  <AlertTriangle size={15} className="text-destructive" />
                  <div>
                    <strong>Critical service shortfall</strong>
                    <p>Review the operating condition at H{s.hour}.</p>
                  </div>
                </div>
              )}
              {events.map((event) => (
                <div className="ops-event" key={event.id}>
                  <span
                    className={
                      event.severity === "critical" || event.severity === "high"
                        ? "ops-event-mark is-critical"
                        : "ops-event-mark"
                    }
                  />
                  <div>
                    <strong>{humanize(event.rule)}</strong>
                    <p>
                      H{event.hour} · {event.hour === s.hour ? "Current hour" : "Recorded earlier"}{" "}
                      · {humanize(event.action)}
                    </p>
                  </div>
                </div>
              ))}
              {!workspace.session &&
                caseEvents.map(({ event, index, hour }) => (
                  <div className="ops-event" key={index}>
                    <span className="ops-event-mark" />
                    <div>
                      <strong>
                        {typeof event["kind"] === "string" ? humanize(event["kind"]) : "Case event"}
                      </strong>
                      <p>
                        H{hour} ·{" "}
                        {typeof event["message"] === "string"
                          ? event["message"]
                          : "Recorded case change"}
                      </p>
                    </div>
                  </div>
                ))}
              {workspace.eventsError && !workspace.session && (
                <p role="alert" className="ops-empty">
                  Case changes unavailable. Refresh evidence to retry.
                </p>
              )}
              {!events.length && !caseEvents.length && !s.critical && (
                <p className="ops-empty">
                  {workspace.session
                    ? "No monitoring events recorded at this point in playback."
                    : "No case changes recorded through this hour. Monitoring alerts require a selected session."}
                </p>
              )}
            </div>
            <Link to="/monitor" className="ops-link">
              Open Monitor <ArrowRight size={13} />
            </Link>
          </section>
        </div>
      </div>
      <section className="ops-review-controls" aria-label="Saved case review">
        <div>
          <strong>{workspace.session ? "Monitoring reference" : "Review saved case"}</strong>
          <span>
            {workspace.session
              ? "Session clock owns the displayed state"
              : "Inspection only · does not execute a plan"}
          </span>
        </div>
        {!workspace.session && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReviewHour(Math.max(0, reviewHour - 6))}
              disabled={reviewHour === 0}
              aria-label="Review previous six hours"
            >
              −6h
            </Button>
            <input
              type="range"
              aria-label="Case review hour"
              min={0}
              max={run.summary.duration_hours - 1}
              value={reviewHour}
              onChange={(event) => setReviewHour(Number(event.target.value))}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setReviewHour(Math.min(run.summary.duration_hours - 1, reviewHour + 6))
              }
              disabled={reviewHour >= run.summary.duration_hours - 1}
              aria-label="Review next six hours"
            >
              +6h
            </Button>
          </>
        )}
        <output>
          H{Math.max(0, s.hour)} <span>/ {run.summary.duration_hours - 1}</span>
        </output>
      </section>
    </div>
  );
}

function DecisionPanel({ workspace }: { workspace: Workspace }) {
  const { setPlanId } = useFirn();
  const { snapshot: s, session, selectedPlan } = workspace;
  let title = "Continue monitored execution";
  let copy = "Inspect the next operating hour in Monitor.";
  let to: "/monitor" | "/plan" = "/monitor";
  let label = "Open Monitor";
  let proposalId: string | null = null;
  if (s.critical || s.posture === "action") {
    title = "Review operating exception";
    copy = "The current sample or event requires operator attention.";
  } else if (session?.pending_proposal_id) {
    title = "A revision is ready for review";
    copy = "The current plan stays active until a replacement is approved and activated.";
    to = "/plan";
    label = "Compare revision";
    proposalId = session.pending_proposal_id;
  } else if (!s.activePlan) {
    title = selectedPlan ? planNextTitle(selectedPlan) : "Establish an operating plan";
    copy = selectedPlan
      ? `Selected plan v${selectedPlan.version_number} is ${selectedPlan.status}.`
      : "Generate a joint mission-and-energy proposal for this case.";
    to = "/plan";
    label = selectedPlan ? "Review plan" : "Open Plan";
  } else if (s.fuelPressure) {
    title = "Review fuel before delivery";
    copy =
      "Recent-consumption runway is shorter than the remaining delivery wait. Inspect the fuel trajectory and operating plan.";
    to = "/plan";
    label = "Inspect plan basis";
  } else if (!session || session.current_hour < 0) {
    title = "Review the execution basis";
    copy =
      "The selected plan is active. Inspect its monitoring reference before continuing execution.";
  } else if (workspace.monitoredPlan?.status !== "active") {
    title = "Resume with the active plan";
    copy = "The previous session references a plan that is no longer active.";
  }
  return (
    <section className="ops-panel ops-next-decision">
      <div className="micro-label">Next operator action</div>
      <h2>{title}</h2>
      <p>{copy}</p>
      <Link
        to={to}
        className="ops-link"
        onClick={() => {
          if (proposalId) setPlanId(proposalId);
        }}
      >
        {label} <ArrowRight size={14} />
      </Link>
    </section>
  );
}

type ChartRow = {
  hour: number;
  demand: number | null;
  renewable: number | null;
  generator: number | null;
  battery: number | null;
  fuel: number | null;
};
function ReserveChart({
  title,
  unit,
  data,
  dataKey,
  reserve,
  domain,
}: {
  title: string;
  unit: string;
  data: ChartRow[];
  dataKey: "battery" | "fuel";
  reserve: number | null;
  domain: [number, number];
}) {
  return (
    <div className="ops-reserve-chart">
      <div className="ops-reserve-title">
        <h3>{title}</h3>
        <span>{reserve !== null ? `Reserve ${number(reserve)} ${unit}` : unit}</span>
      </div>
      <div
        className="ops-reserve-plot"
        role="img"
        aria-label={`${title} in ${unit} from hour ${domain[0]} to ${domain[1]}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            syncId="operations-horizon"
            margin={{ top: 6, right: 6, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="hour"
              type="number"
              domain={domain}
              tick={axis}
              tickFormatter={(hour) => `H${hour}`}
              tickLine={false}
              axisLine={false}
              minTickGap={50}
            />
            <YAxis
              tick={axis}
              width={44}
              tickLine={false}
              axisLine={false}
              domain={[0, "auto"]}
              tickFormatter={(value) =>
                value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)
              }
            />
            <Tooltip
              contentStyle={tooltip}
              labelFormatter={(hour) => `Operating hour ${hour}`}
              formatter={chartNumber}
            />
            <Line
              type="linear"
              dataKey={dataKey}
              name={`${title} (${unit})`}
              stroke="var(--primary)"
              dot={false}
              strokeWidth={1.6}
              isAnimationActive={false}
            />
            {reserve !== null && (
              <ReferenceLine y={reserve} stroke="var(--warning)" strokeDasharray="3 3" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Margin({
  icon: Icon,
  label,
  value,
  unit,
  detail,
  note,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  unit: string;
  detail: string;
  note: string;
  tone: "neutral" | "good" | "warn" | "critical";
}) {
  return (
    <div className={`ops-margin tone-${tone}`}>
      <div className="ops-margin-label">
        <span>{label}</span>
        <Icon size={16} aria-hidden="true" />
      </div>
      <div className="ops-margin-value">
        {value}
        <span>{unit}</span>
      </div>
      <p>{detail}</p>
      <small>{note}</small>
    </div>
  );
}

function WorkspaceState({
  title,
  copy,
  retry,
}: {
  title: string;
  copy: string;
  retry?: () => void;
}) {
  const { setCaseLibraryOpen } = useFirn();
  return (
    <section className="ops-panel ops-setup" role={retry ? "alert" : "status"}>
      <div className="micro-label">Operations</div>
      <h1>{title}</h1>
      <p>{copy}</p>
      <div className="flex flex-wrap gap-3">
        {retry && (
          <Button onClick={retry} variant="outline">
            Retry
          </Button>
        )}
        <Button onClick={() => setCaseLibraryOpen(true)}>
          Open case library <ArrowRight size={14} />
        </Button>
      </div>
    </section>
  );
}
function planNextTitle(plan: PlanVersion) {
  return plan.status === "rejected" || plan.status === "superseded"
    ? "Choose an operating proposal"
    : plan.status === "approved"
      ? "Activate the approved plan"
      : "Review the operating proposal";
}
function number(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}
function optionalNumber(value: number | null) {
  return value === null ? "—" : number(value);
}
function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function duration(hours: number) {
  return hours < 24 ? `${number(hours)} h` : `${number(hours / 24)} d`;
}
function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}
function chartNumber(value: number | string) {
  return typeof value === "number" ? number(value) : value;
}
