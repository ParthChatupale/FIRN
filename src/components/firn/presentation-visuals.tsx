import { useState, type ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, Check, ChevronRight, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { usePresentation } from "@/lib/presentation-context";
import {
  currentStation,
  missionProgress,
  missionSchedule,
  resourceOutlook,
  stationTrajectory,
  STATION,
  type Mission,
  type PlanKind,
  type StationPoint,
} from "@/lib/presentation-model";

export const format = (n: number, digits = 0) =>
  n.toLocaleString("en-GB", { maximumFractionDigits: digits });
export function Panel({
  title,
  meta,
  children,
  className = "",
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`studio-panel ${className}`}>
      <header className="studio-panel-header">
        <h2>{title}</h2>
        {meta}
      </header>
      {children}
    </section>
  );
}
export function PageTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="studio-page-title">
      <div>
        <div className="studio-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Chart({
  rows,
  mode = "power",
  height = 185,
  event = false,
}: {
  rows: StationPoint[];
  mode?: "power" | "battery" | "fuel";
  height?: number;
  event?: boolean | number;
}) {
  const unit = mode === "power" ? "kW" : mode === "battery" ? "kWh" : "L";
  return (
    <div
      className="studio-chart"
      role="img"
      aria-label={`${mode === "power" ? "Renewable, generator and battery supply versus demand" : mode === "battery" ? "Battery trajectory and protected reserve" : "Fuel inventory trajectory"}, ${unit}, H${rows[0]?.hour ?? 0}–H${rows.at(-1)?.hour ?? 0}`}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 9, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#25404b" strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="hour"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => `H${v}`}
            tick={{ fill: "#91a7b5", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={36}
          />
          <YAxis
            tick={{ fill: "#91a7b5", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            domain={mode === "battery" ? [0, 400] : [0, "auto"]}
            tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
          />
          <Tooltip
            labelFormatter={(v) => `Operating hour H${v}`}
            formatter={(value: number, name: string) => [`${format(value, 1)} ${unit}`, name]}
            contentStyle={{
              background: "#11212d",
              border: "1px solid #34505e",
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: "#e8f2f8" }}
          />
          {mode === "power" ? (
            [
              <Area
                key="renewable"
                type="monotone"
                dataKey="renewable"
                name="Renewables"
                stackId="supply"
                stroke="#62d5ae"
                fill="#62d5ae"
                fillOpacity={0.28}
                isAnimationActive={false}
              />,
              <Area
                key="generator"
                type="monotone"
                dataKey="generator"
                name="Diesel"
                stackId="supply"
                stroke="#4298c9"
                fill="#4298c9"
                fillOpacity={0.19}
                isAnimationActive={false}
              />,
              <Area
                key="discharge"
                type="monotone"
                dataKey="discharge"
                name="Battery discharge"
                stackId="supply"
                stroke="#a79bff"
                fill="#a79bff"
                fillOpacity={0.3}
                isAnimationActive={false}
              />,
              <Line
                key="demand"
                type="monotone"
                dataKey="demand"
                name="Demand"
                stroke="#f3e5bb"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />,
            ]
          ) : (
            <Line
              type="monotone"
              dataKey={mode}
              name={mode === "battery" ? "Battery energy" : "Fuel inventory"}
              stroke={mode === "battery" ? "#c9b4ff" : "#58cde0"}
              strokeWidth={2}
              dot={rows.length === 1}
              isAnimationActive={false}
            />
          )}
          {mode === "battery" && (
            <ReferenceLine
              y={STATION.batteryReserve}
              stroke="#edb45f"
              strokeDasharray="4 4"
              label={{
                value: "Protected reserve",
                fill: "#edb45f",
                fontSize: 10,
                position: "insideTopRight",
              }}
            />
          )}
          {event && (
            <ReferenceLine
              x={typeof event === "number" ? event : 24}
              stroke="#edb45f"
              strokeDasharray="4 4"
              label={{
                value: "Weather",
                fill: "#edb45f",
                position: "insideTopRight",
                fontSize: 10,
              }}
            />
          )}
          {mode === "power" && (
            <Legend
              iconType="plainline"
              iconSize={12}
              wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ValuesTable({ rows }: { rows: StationPoint[] }) {
  return (
    <details className="studio-values">
      <summary>Inspect hourly values</summary>
      <div className="studio-table-scroll">
        <table>
          <thead>
            <tr>
              {[
                "Hour",
                "Demand kW",
                "Renewable kW",
                "Diesel kW",
                "Charge kW",
                "Discharge kW",
                "Battery kWh",
                "Fuel L",
              ].map((s) => (
                <th key={s}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.hour}>
                <td>H{r.hour}</td>
                <td>{r.demand}</td>
                <td>{r.renewable}</td>
                <td>{r.generator}</td>
                <td>{r.charge}</td>
                <td>{r.discharge}</td>
                <td>{r.battery}</td>
                <td>{r.fuel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
export function MissionTimeline({
  kind,
  compact = false,
  comparison,
}: {
  kind: PlanKind;
  compact?: boolean;
  comparison?: PlanKind | undefined;
}) {
  const { state } = usePresentation();
  const [selected, setSelected] = useState<Mission | null>(null);
  const missions = missionSchedule(kind, state);
  const before = comparison ? missionSchedule(comparison, state) : null;
  const end = 48;
  return (
    <div className={`studio-gantt ${compact ? "compact" : ""}`}>
      <div className="studio-gantt-ruler">
        <span>MISSION / WINDOW</span>
        <div>
          {[0, 6, 12, 18, 24, 30, 36, 42, 48].map((h) => (
            <span key={h} style={{ left: `${(h / end) * 100}%` }}>
              {h === 0 ? "H0" : h}
            </span>
          ))}
        </div>
        <span>STATE</span>
      </div>
      {missions.map((m) => {
        const old = before?.find((x) => x.id === m.id);
        const status = missionProgress(state, m);
        return (
          <button
            key={m.id}
            className="studio-gantt-row"
            onClick={() => setSelected(selected?.id === m.id ? null : m)}
            aria-expanded={selected?.id === m.id}
          >
            <span className="studio-mission-name">
              {m.short}
              <small>{compact ? m.priority : m.resource}</small>
            </span>
            <span className="studio-gantt-lane">
              {old && !old.deferred && (
                <span
                  className="studio-gantt-before"
                  style={{
                    left: `${(old.start / end) * 100}%`,
                    width: `${(old.duration / end) * 100}%`,
                  }}
                />
              )}
              {!m.deferred && (
                <span
                  className={`studio-gantt-bar ${status === "Completed" ? "completed" : m.priority === "Flexible" ? "flexible" : ""}`}
                  style={{
                    left: `${(m.start / end) * 100}%`,
                    width: `${(m.duration / end) * 100}%`,
                  }}
                  title={`${m.name}, H${m.start}–H${m.start + m.duration}`}
                />
              )}
              {state.outlookChanged && m.id === "field" && (
                <span
                  className="studio-gantt-weather"
                  style={{ left: `${(10 / end) * 100}%`, width: `${(4 / end) * 100}%` }}
                />
              )}
              <span
                className="studio-gantt-cursor"
                style={{ left: `${(state.hour / end) * 100}%` }}
              />
            </span>
            <span
              className={`studio-mission-state ${m.deferred ? "text-amber" : status === "Completed" ? "text-mint" : ""}`}
            >
              {compact && status === "Scheduled" ? `H${m.start}–${m.start + m.duration}` : status}
            </span>
          </button>
        );
      })}
      {selected && (
        <div className="studio-mission-detail">
          <strong>{selected.name}</strong>
          <span>
            {selected.resource} · {selected.power} kW · {selected.duration}h · {selected.priority}{" "}
            priority
          </span>
          <span>
            {selected.deferred
              ? "Deferred beyond this operating window"
              : `Scheduled H${selected.start}–H${selected.start + selected.duration}`}
          </span>
        </div>
      )}
      {(!compact || comparison) && (
        <div className="studio-gantt-legend">
          <span>
            <i />
            Selected schedule
          </span>
          {comparison && (
            <span>
              <i className="before" />
              Previous schedule
            </span>
          )}
          {state.outlookChanged && (
            <span className="text-amber">
              H10–H14 early restriction · weather front H{state.inputs.weatherHour}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
export function ApprovalPanel({ compact = false }: { compact?: boolean }) {
  const { state, dispatch } = usePresentation();
  const p = state.proposal;
  const before = resourceOutlook(state, state.activeKind);
  const after = p ? resourceOutlook(state, p.kind) : before;
  const oldMissions = missionSchedule(state.activeKind, state);
  const changes = p
    ? missionSchedule(p.kind, state)
        .filter((m) => {
          const old = oldMissions.find((o) => o.id === m.id)!;
          return old.start !== m.start || !!old.deferred !== !!m.deferred;
        })
        .map((m) => ({
          name: m.short,
          before: `H${oldMissions.find((o) => o.id === m.id)!.start}`,
          after: m.deferred ? "Deferred" : `H${m.start}`,
        }))
    : [];
  return (
    <Panel
      title={p ? `Plan V${p.version} · ${p.status}` : "Operator decision"}
      meta={
        <span className={`studio-chip ${p ? "warn" : "good"}`}>
          {p ? "REVIEW REQUIRED" : "ACTIVE"}
        </span>
      }
      className="studio-approval"
    >
      {p ? (
        <>
          <p className="studio-decision-trigger">{p.trigger}</p>
          {!p.feasible && (
            <div role="status" className="studio-no-go">
              <strong>NO-GO / cannot authorize</strong>
              {p.problems.map((problem) => (
                <p key={problem}>{problem}</p>
              ))}
            </div>
          )}
          <div className="studio-proposal-changes">
            {changes.slice(0, compact ? 2 : 4).map((c) => (
              <div key={c.name}>
                <span>{c.name}</span>
                <strong>
                  {c.before} → {c.after}
                </strong>
              </div>
            ))}
          </div>
          {!compact && (
            <div className="studio-decision-deltas">
              <div>
                <span>Projected fuel consumption · next 48h</span>
                <strong>
                  {format(
                    stationTrajectory(state, state.activeKind, false, state.hour + 48)
                      .filter((r) => r.hour >= state.hour && r.hour < state.hour + 48)
                      .reduce((n, r) => n + r.fuelRate, 0),
                    1,
                  )}{" "}
                  →{" "}
                  {format(
                    stationTrajectory(state, p.kind, false, state.hour + 48)
                      .filter((r) => r.hour >= state.hour && r.hour < state.hour + 48)
                      .reduce((n, r) => n + r.fuelRate, 0),
                    1,
                  )}{" "}
                  L
                </strong>
              </div>
              <div>
                <span>Fuel at resupply</span>
                <strong>
                  {format(before.fuelAtResupply)} → {format(after.fuelAtResupply)} L
                </strong>
              </div>
              <div>
                <span>Adverse battery reserve margin</span>
                <strong>{format(p.minimumBattery - STATION.batteryReserve, 1)} kWh minimum</strong>
              </div>
              <div>
                <span>Remaining work</span>
                <strong>
                  {changes.length} schedule {changes.length === 1 ? "change" : "changes"} ·{" "}
                  {p.schedule.filter((m) => m.deferred).length} deferred
                </strong>
              </div>
            </div>
          )}
          <div className="studio-lifecycle">
            {["proposed", "reviewed", "approved", "active"].map((s, i) => (
              <span key={s} className={s === p.status ? "current" : ""}>
                {s}
                {i < 3 && <ChevronRight size={12} />}
              </span>
            ))}
          </div>
          <div className="studio-action-row">
            {p.status === "proposed" && (
              <button className="studio-button" onClick={() => dispatch({ type: "review" })}>
                <ShieldCheck size={15} />
                Review proposal
              </button>
            )}
            {p.status === "reviewed" && (
              <button
                className="studio-button"
                disabled={!p.feasible}
                onClick={() => dispatch({ type: "approve" })}
              >
                <Check size={15} />
                Approve plan
              </button>
            )}
            {p.status === "approved" && (
              <button className="studio-button" onClick={() => dispatch({ type: "activate" })}>
                Activate V{p.version}
                <ArrowUpRight size={15} />
              </button>
            )}
            <button className="studio-button quiet" onClick={() => dispatch({ type: "reject" })}>
              Reject
            </button>
          </div>
          <small className="studio-footnote">
            V{state.activeVersion} remains active until explicit activation.
          </small>
        </>
      ) : (
        <>
          <div className="studio-protected">
            <ShieldCheck size={20} />
            <div>
              <strong>Plan V{state.activeVersion} in force</strong>
              <small>
                {state.hour >= STATION.playbackEnd
                  ? "Operating case complete · inspect decision history"
                  : "No revision awaiting authorization"}
              </small>
            </div>
          </div>
          <Link
            to={state.hour >= STATION.playbackEnd ? "/decision-log" : "/mission-planner"}
            className="studio-inline-link"
          >
            {state.hour >= STATION.playbackEnd ? "Inspect decisions" : "Inspect active plan"}
            <ArrowUpRight size={14} />
          </Link>
        </>
      )}
    </Panel>
  );
}
export function AssetMatrix() {
  const { state } = usePresentation();
  const c = currentStation(state);
  return (
    <div className="studio-asset-matrix">
      {[
        {
          name: "Generator 01",
          value: `${format(c.g1, 1)} / ${c.g1Capacity} kW`,
          status: state.derated ? "Derated" : c.g1 ? "Running" : "Standby",
          load: c.g1 / Math.max(1, c.g1Capacity),
          warning: state.derated,
        },
        {
          name: "Generator 02",
          value: `${format(c.g2, 1)} / ${STATION.generatorTwo} kW`,
          status: c.g2 ? "Running" : "Standby",
          load: c.g2 / STATION.generatorTwo,
          warning: false,
        },
        {
          name: "Battery storage",
          value: `${format((c.battery / STATION.batteryCapacity) * 100)}% · ${format(c.battery)} kWh`,
          status: "Available",
          load: c.battery / STATION.batteryCapacity,
          warning: false,
        },
      ].map((a) => (
        <div className="studio-asset" key={a.name}>
          <div>
            <strong>{a.name}</strong>
            <span className={a.warning ? "text-amber" : ""}>{a.status}</span>
          </div>
          <div className="studio-capacity">
            <i
              style={{ width: `${a.load * 100}%`, background: a.warning ? "#edb45f" : undefined }}
            />
          </div>
          <small>{a.value}</small>
        </div>
      ))}
    </div>
  );
}
