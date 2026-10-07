import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
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
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BatteryCharging,
  Check,
  Clock3,
  CloudSnow,
  Fuel,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Wind,
  Zap,
} from "lucide-react";
import { usePresentation } from "@/lib/presentation-context";
import { RecordingSimulator } from "./recording-simulator";
import { AttentionQueue, PreparationStatus, DecisionLink } from "./recording-attention";
import { forecastCase, playbackBlock } from "@/lib/recording-workflow";
import { buildComparisonReport, comparisonMatchesState } from "@/lib/recording-comparison";
import { MissionActivity } from "./recording-playback";
import { MissionIssueReporting } from "./recording-mission-report";
import {
  currentStation,
  conflictCount,
  forecastRows,
  environmentalPoint,
  monitoringReference,
  missionProgress,
  missionSchedule,
  resourceOutlook,
  stationTime,
  stationHour,
  stationTrajectory,
  observedHistory,
  STATION,
  type PlanKind,
} from "@/lib/presentation-model";
import {
  ApprovalPanel,
  AssetMatrix,
  Chart,
  format,
  MissionTimeline,
  PageTitle,
  Panel,
  ValuesTable,
} from "./presentation-visuals";

export function PresentationScreen({ path }: { path: string }) {
  switch (path) {
    case "/mission-planner":
      return <Planner />;
    case "/forecast":
      return <Outlook />;
    case "/monitoring":
      return <Monitor />;
    case "/scenario-simulator":
      return <ScenarioLab />;
    case "/energy-assets":
      return <Assets />;
    case "/decision-log":
      return <Decisions />;
    default:
      return <Operations />;
  }
}

function Operations() {
  const { state } = usePresentation();
  const [view, setView] = useState<"projection" | "observed">("projection");
  const c = currentStation(state);
  const observed = observedHistory(state);
  const projected = stationTrajectory(
    forecastCase(state),
    state.activeKind,
    false,
    state.hour + 48,
  ).filter((r) => r.hour >= state.hour);
  const rows = view === "observed" ? observed : projected;
  const outlook = resourceOutlook(forecastCase(state), state.activeKind);
  const missions = missionSchedule(state.activeKind, state);
  const completed = missions.filter((m) => missionProgress(state, m) === "Completed").length;
  const avgFuel = projected.slice(0, 24).reduce((sum, r) => sum + r.fuelRate, 0) / 24;
  return (
    <>
      <PageTitle
        eyebrow="STATION COMMAND"
        title="Operations"
        action={
          <div className="studio-title-status">
            <span className={`studio-chip ${c.criticalServed ? "good" : "warn"}`}>
              <ShieldCheck size={13} />
              Critical services {c.criticalServed ? "served" : "at risk"}
            </span>
            <Link to="/forecast" className="studio-inline-link">
              Look ahead
              <ArrowUpRight size={15} />
            </Link>
          </div>
        }
      />
      <div className="studio-kpi-grid">
        <Metric
          label="Battery above reserve"
          value={`${format(c.battery - STATION.batteryReserve)} kWh`}
          icon={BatteryCharging}
          detail={`${format((c.battery / STATION.batteryCapacity) * 100)}% SOC · reserve ${STATION.batteryReserve} kWh`}
          accent="violet"
        />
        <Metric
          label="Fuel inventory"
          value={`${format(c.fuel)} L`}
          icon={Fuel}
          detail={`${format(c.fuel / Math.max(1, avgFuel) / 24, 1)} days at projected 24h rate`}
          accent="cyan"
        />
        <Metric
          label="Resupply horizon"
          value={`${format(outlook.arrivalDay - state.hour / 24, 1)} days`}
          icon={Clock3}
          detail={`${format(outlook.fuelAtResupply)} L projected on arrival`}
          accent={state.outlookChanged ? "amber" : "cyan"}
        />
        <Metric
          label="Mission delivery"
          value={`${completed} / ${missions.length}`}
          icon={Activity}
          detail={`${missions.filter((m) => !m.deferred && missionProgress(state, m) !== "Completed").length} remaining · ${missions.filter((m) => m.deferred).length} deferred`}
          accent="mint"
        />
      </div>
      <div className="studio-operations-grid">
        <div className="studio-operations-main">
          <Panel
            title="Operating power balance"
            meta={
              <div className="studio-segmented">
                <button
                  className={view === "projection" ? "selected" : ""}
                  onClick={() => setView("projection")}
                >
                  Plan outlook
                </button>
                <button
                  className={view === "observed" ? "selected" : ""}
                  onClick={() => setView("observed")}
                >
                  Observed
                </button>
              </div>
            }
          >
            <div className="studio-chart-meta">
              <strong>
                {format(c.demand, 1)} kW <small>current demand</small>
              </strong>
              <span>
                {view === "projection"
                  ? `V${state.activeVersion} projection · next 48h`
                  : `48h prior history · through ${stationTime(stationHour(state))}`}{" "}
                · kW
              </span>
            </div>
            <Chart
              rows={rows}
              height={150}
              event={
                forecastCase(state).inputs.weatherSeverity > 0 && view === "projection"
                  ? forecastCase(state).inputs.weatherHour
                  : false
              }
            />
          </Panel>
          <div className="studio-small-multiples">
            <Panel title="Battery reserve" meta={<span className="studio-unit">kWh</span>}>
              <Chart rows={rows} mode="battery" height={90} />
            </Panel>
            <Panel title="Fuel inventory" meta={<span className="studio-unit">L</span>}>
              <Chart rows={rows} mode="fuel" height={90} />
            </Panel>
          </div>
          <Panel
            title="Mission operating windows"
            meta={
              <Link to="/mission-planner" className="studio-inline-link">
                Full schedule
                <ArrowUpRight size={13} />
              </Link>
            }
          >
            <MissionTimeline kind={state.activeKind} compact />
          </Panel>
        </div>
        <div className="studio-operations-rail">
          <MissionActivity />
          <Panel
            title="Assets & station load"
            meta={
              <Link to="/energy-assets" aria-label="Open asset details">
                <ArrowUpRight size={16} />
              </Link>
            }
          >
            <AssetMatrix />
            <div className="studio-load-strip">
              <span>
                <i />
                Critical {STATION.criticalLoad} kW
              </span>
              <span>Mission {format(c.missionPower)} kW</span>
              <strong>
                {format((c.renewable / Math.max(1, c.renewable + c.generator + c.discharge)) * 100)}
                % supply renewable
              </strong>
            </div>
          </Panel>
          <Panel
            title="Operating conditions"
            meta={<span className="studio-unit">H{state.hour}</span>}
          >
            <div className="studio-weather-inline">
              <CloudSnow size={23} />
              <div>
                <strong>
                  {c.temperature.toFixed(1)}°C <span>{format(c.wind)} km/h</span>
                </strong>
                <small>
                  Visibility {c.visibility} km ·{" "}
                  {c.visibility < 2 ? "Field access restricted" : "Field conditions usable"}
                </small>
              </div>
            </div>
          </Panel>
          <Panel title="Attention required">
            <PreparationStatus />
            <AttentionQueue compact />
          </Panel>
        </div>
      </div>
      <ValuesTable rows={rows} />
    </>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  detail,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof Zap;
  detail: string;
  accent: string;
}) {
  return (
    <section className={`studio-metric ${accent}`}>
      <div>
        <h2>{label}</h2>
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </section>
  );
}
function Planner() {
  const { state, dispatch } = usePresentation();
  const [selected, setSelected] = useState<PlanKind | "active">("active");
  const proposalVersion = state.proposal?.version;
  useEffect(() => {
    if (proposalVersion) setSelected("joint");
  }, [proposalVersion]);
  const report = state.comparisonReport ?? buildComparisonReport(state, "assessment");
  const currentComparison = comparisonMatchesState(report, state);
  const inspectable = currentComparison && !state.preparation;
  const candidate = report.entries.find((entry) => entry.approach === "joint")!.kind;
  const variants: { kind: PlanKind; name: string; sub: string }[] = [
    { kind: "original", name: "Original schedule", sub: "Keep mission timing unchanged" },
    { kind: "energy", name: "Energy-first", sub: "Defer flexible scientific work" },
    { kind: "joint", name: "Joint mission–energy", sub: "Coordinate windows and shared resources" },
  ];
  const visibleKind =
    !inspectable || selected === "active"
      ? state.activeKind
      : selected === "joint"
        ? candidate
        : selected;
  const rows = stationTrajectory(forecastCase(state), visibleKind, false, 48);
  return (
    <>
      <PageTitle
        eyebrow="JOINT OPERATIONAL PLANNING"
        title="Mission Planner"
        subtitle="Mission timing, energy dispatch and resource limits on one operating horizon."
        action={
          <button
            className="studio-button"
            disabled={
              !!state.proposal ||
              !!state.preparation ||
              state.hour >= STATION.playbackEnd ||
              state.forecastReadyBasis !== state.assumptionVersion
            }
            onClick={() => dispatch({ type: "generate" })}
          >
            <SlidersHorizontal size={16} />
            {state.preparation?.kind === "plan" ? "Preparing proposal…" : "Generate joint proposal"}
          </button>
        }
      />
      <PreparationStatus />
      <div className="recording-plan-basis">
        <strong>
          Active V{state.activeVersion} ·{" "}
          {state.activeKind === "original" ? "Original schedule" : "Authorized joint schedule"}
        </strong>
        <span>
          Issued arrival{" "}
          {stationTime(STATION.resupplyHour + state.activations.at(-1)!.inputs.resupplyDelay * 24)}{" "}
          · applied outlook revision {state.assumptionVersion}
        </span>
      </div>
      {
        <>
          <p className="recording-plan-basis">
            <strong>
              {report.source === "baseline"
                ? "Baseline comparison"
                : report.source === "generated"
                  ? "Generated comparison"
                  : "Current-state comparison"}
            </strong>
            <span>
              {stationTime(report.hour + report.minute / 60)} · assumptions {report.basis}
              {currentComparison
                ? " · evaluated alternatives; activation is separate"
                : " · previous basis; generate to refresh"}
              {state.preparation?.kind === "plan" ? " · preparing updated comparison…" : ""}
            </span>
          </p>
          <div className="studio-segmented">
            <button
              className={selected === "active" || !inspectable ? "selected" : ""}
              onClick={() => setSelected("active")}
            >
              Active plan
            </button>
          </div>
          <div className="studio-strategy-grid recording-strategies">
            {variants.map((v) => {
              const o = report.entries.find((entry) => entry.approach === v.kind)!.outlook;
              return (
                <button
                  key={v.kind}
                  className={`studio-strategy ${inspectable && selected === v.kind ? "selected" : ""}`}
                  disabled={!inspectable}
                  title={
                    inspectable
                      ? "Inspect evaluated alternative; this does not activate it"
                      : "Previous comparison; generate to refresh before inspecting"
                  }
                  onClick={() => setSelected(v.kind)}
                  aria-pressed={inspectable && selected === v.kind}
                >
                  <div>
                    <strong>{v.name}</strong>
                    {v.kind === "joint" && <span className="studio-chip">FIRN</span>}
                    {v.kind === "original" && state.activeKind === "original" && (
                      <span className="studio-chip">ACTIVE V{state.activeVersion}</span>
                    )}
                  </div>
                  <p>{v.sub}</p>
                  <dl>
                    <div>
                      <dt>Missions scheduled</dt>
                      <dd>{o.missions} / 6</dd>
                    </div>
                    <div>
                      <dt>Fuel at resupply</dt>
                      <dd>{format(o.fuelAtResupply)} L</dd>
                    </div>
                    <div>
                      <dt>Minimum reserve margin</dt>
                      <dd>{format(o.minimumBattery - STATION.batteryReserve)} kWh</dd>
                    </div>
                    <div>
                      <dt>Shared-resource conflicts</dt>
                      <dd className={o.conflicts ? "text-amber" : "text-mint"}>
                        {o.conflicts ? `${o.conflicts} unresolved` : "None"}
                      </dd>
                    </div>
                  </dl>
                </button>
              );
            })}
          </div>
        </>
      }
      <div className="studio-planner-grid">
        <div className="studio-stack">
          <Panel
            title={
              selected === "joint" && inspectable
                ? `Joint schedule · ${state.proposal ? `proposed V${state.proposal.version}` : "candidate comparison"}`
                : selected === "active" || !inspectable
                  ? `Active schedule · V${state.activeVersion}`
                  : "Alternative mission schedule"
            }
            meta={<span className="studio-unit">H0–H48</span>}
          >
            <MissionTimeline
              kind={visibleKind}
              compact
              comparison={
                selected === "joint" && inspectable && state.proposal ? state.activeKind : undefined
              }
            />
          </Panel>
          <Panel
            title="Mission-aligned energy dispatch"
            meta={<span className="studio-unit">kW</span>}
          >
            <Chart
              rows={rows}
              height={190}
              event={
                forecastCase(state).inputs.weatherSeverity > 0
                  ? forecastCase(state).inputs.weatherHour
                  : false
              }
            />
          </Panel>
          <div className="studio-small-multiples">
            <Panel title="Battery trajectory" meta={<span className="studio-unit">kWh</span>}>
              <Chart rows={rows} mode="battery" height={120} />
            </Panel>
            <Panel title="Fuel trajectory" meta={<span className="studio-unit">L</span>}>
              <Chart rows={rows} mode="fuel" height={120} />
            </Panel>
          </div>
        </div>
        <div className="studio-stack">
          <ApprovalPanel />
          <Panel title="Planning attention">
            <AttentionQueue scope="planning" compact />
          </Panel>
          <Panel title="Configured operating constraints">
            <ConstraintList />
            <details className="recording-advanced">
              <summary>Planning basis and checks</summary>
              <strong>
                {candidate === "adaptive"
                  ? "Response to asset degradation"
                  : candidate === "weather"
                    ? "Response to updated outlook"
                    : "Why coordinate the schedule?"}
              </strong>
              <p>
                {candidate === "adaptive"
                  ? "Preserve executed work. Search the remaining mission windows against reduced capacity, reserve and adverse weather. Flexible work may be deferred; an infeasible response cannot be activated."
                  : candidate === "weather"
                    ? "Re-evaluate field access, resource overlaps and fuel exposure using the revised weather and arrival assumptions. Proposed timing is shown on the schedule, not imposed on current execution."
                    : "The original laboratory and atmospheric study overlap on the instrument team. Joint scheduling separates their windows without dropping the laboratory mission."}
              </p>
            </details>
          </Panel>
        </div>
      </div>
    </>
  );
}
function ConstraintList() {
  return (
    <div className="studio-constraints">
      {[
        "Critical station demand protected",
        "Battery reserve ≥ 100 kWh",
        "Generator capacity bounds respected",
        "No instrument-team overlap",
        "Field visibility ≥ 2 km",
        "Operator activation required",
      ].map((c) => (
        <div key={c}>
          <ShieldCheck size={14} />
          <span>{c}</span>
        </div>
      ))}
    </div>
  );
}

function Outlook() {
  const { state } = usePresentation();
  const [horizon, setHorizon] = useState(48);
  const published = forecastCase(state);
  const updated = stationTrajectory(published, state.activeKind, false, horizon);
  const points = forecastRows(published, horizon);
  const o = resourceOutlook(published, state.activeKind);
  const event = environmentalPoint(published.inputs.weatherHour, published.inputs);
  const field = state.activeSchedule.find((m) => m.id === "field")!;
  return (
    <>
      <PageTitle
        eyebrow="FORECAST & SCENARIO EXPOSURE"
        title="Look ahead"
        subtitle="Translate changing assumptions into mission windows and resource pressure."
        action={
          <Link to="/scenario-simulator" className="studio-button secondary">
            Change scenario
            <ArrowRight size={16} />
          </Link>
        }
      />
      <PreparationStatus />
      {state.preparation?.kind === "forecast" && (
        <p role="status" className="recording-plan-basis">
          New inputs received. Previous published outlook remains below until the refresh completes.
        </p>
      )}
      <div className="studio-outlook-metrics">
        <Metric
          label="Weather outlook"
          value={published.inputs.weatherSeverity > 0 ? "Deteriorating" : "Stable"}
          detail={
            published.inputs.weatherSeverity > 0
              ? `Weather front ${stationTime(published.inputs.weatherHour)}`
              : "Usable field conditions through H48"
          }
          icon={Wind}
          accent={published.inputs.weatherSeverity > 0 ? "amber" : "mint"}
        />
        <Metric
          label="Active field commitment"
          value={
            field.deferred ? "Unavailable" : `H${field.start}–H${field.start + field.duration}`
          }
          detail="Issued schedule · inspect forecast restrictions"
          icon={Clock3}
          accent="cyan"
        />
        <Metric
          label="Resupply projection"
          value={`Day ${o.arrivalDay}`}
          detail={
            published.inputs.resupplyDelay
              ? `+${published.inputs.resupplyDelay} days against baseline`
              : "Baseline arrival assumption"
          }
          icon={Fuel}
          accent="cyan"
        />
      </div>
      <div className="studio-planner-grid">
        <div className="studio-stack">
          <Panel
            title="Renewable availability outlook"
            meta={
              <div className="studio-segmented">
                {[24, 48, 72].map((h) => (
                  <button
                    key={h}
                    className={horizon === h ? "selected" : ""}
                    onClick={() => setHorizon(h)}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            }
          >
            <div
              className="studio-forecast-chart"
              role="img"
              aria-label="Renewable outlook, baseline and illustrative adverse range in kW"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={points} margin={{ left: -15, right: 12, top: 20 }}>
                  <CartesianGrid stroke="#25404b" strokeDasharray="3 5" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    type="number"
                    domain={[0, horizon]}
                    tickFormatter={(v) => `H${v}`}
                    tick={{ fill: "#91a7b5", fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: "#91a7b5", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#11212d", borderColor: "#34505e", fontSize: 12 }}
                    labelFormatter={(v) => `H${v} · kW`}
                  />
                  <Area
                    dataKey="range"
                    name="Nominal / adverse assumptions"
                    stroke="none"
                    fill="#62d5ae"
                    fillOpacity={0.12}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="baseline"
                    name="Baseline outlook"
                    stroke="#7f95a8"
                    strokeDasharray="5 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="expected"
                    name="Current published outlook"
                    stroke="#62d5ae"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  {published.inputs.weatherSeverity > 0 && (
                    <ReferenceLine
                      x={published.inputs.weatherHour}
                      stroke="#edb45f"
                      label={{
                        value: `H${published.inputs.weatherHour}`,
                        fill: "#edb45f",
                        fontSize: 10,
                      }}
                    />
                  )}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="studio-chart-caption">
              kW · deterministic weather-response projection · shaded range is illustrative, not a
              confidence interval
            </div>
          </Panel>
          <div className="studio-small-multiples">
            <Panel title="Battery exposure" meta={<span className="studio-unit">kWh</span>}>
              <Chart rows={updated} mode="battery" height={145} />
            </Panel>
            <Panel title="Fuel exposure" meta={<span className="studio-unit">L</span>}>
              <Chart rows={updated} mode="fuel" height={145} />
            </Panel>
          </div>
          <ValuesTable rows={updated} />
        </div>
        <div className="studio-stack">
          <Panel
            title="Planning impact"
            meta={
              <span className={`studio-chip ${state.outlookChanged ? "warn" : "good"}`}>
                {state.outlookChanged ? "REVIEW" : "BASELINE"}
              </span>
            }
          >
            <AttentionQueue scope="forecast" compact />
            <div className="studio-planning-explanation">
              <strong>Changed assumptions do not activate a plan.</strong>
              <p>
                Compare the resource exposure, prepare a joint proposal and authorize its adoption.
              </p>
              <Link to="/mission-planner" className="studio-button">
                Review planning response
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </Panel>
          <Panel title="Weather assumptions">
            <div className="studio-assumption-row">
              <span>Opening observation</span>
              <strong>
                {format(state.observations[0]!.temperature, 1)}°C ·{" "}
                {format(state.observations[0]!.wind, 1)} km/h
              </strong>
            </div>
            <div className="studio-assumption-row">
              <span>
                {published.inputs.weatherSeverity > 0
                  ? "Front temperature / wind"
                  : "Baseline outlook temperature / wind"}
              </span>
              <strong>
                {format(event.temperature, 1)}°C · {format(event.wind, 1)} km/h
              </strong>
            </div>
            <div className="studio-assumption-row">
              <span>Early field restriction</span>
              <strong>
                {published.inputs.weatherSeverity > 0.5 ? "H10–H14 · 1.4 km visibility" : "None"}
              </strong>
            </div>
            <div className="studio-assumption-row">
              <span>Visibility</span>
              <strong>{format(event.visibility, 1)} km in published outlook</strong>
            </div>
            <div className="studio-assumption-row">
              <span>Resupply shift</span>
              <strong>
                {published.inputs.resupplyDelay
                  ? `+${published.inputs.resupplyDelay} days`
                  : "None"}
              </strong>
            </div>
            <p className="studio-footnote">
              Scenario inputs supplied by the station model. This is not an independent
              weather-prediction service.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}

function ScenarioLab() {
  return <RecordingSimulator />;
}

function Monitor() {
  const { state, dispatch } = usePresentation();
  const observed = observedHistory(state);
  const reference = monitoringReference(state);
  const c = currentStation(state);
  const points = observed.map((r) => ({
    hour: r.hour,
    observed: r.g1,
    expected: r.hour < 0 ? null : (reference[Math.floor(r.hour)] ?? reference.at(-1))!.g1,
  }));
  const paused =
    !!state.proposal ||
    !!state.preparation ||
    state.responseRequired ||
    state.hour >= STATION.playbackEnd;
  return (
    <>
      <PageTitle
        eyebrow="OBSERVE / COMPARE / RESPOND"
        title="Station Monitoring"
        action={
          <span className={`studio-chip ${state.proposal ? "warn" : "good"}`}>
            {state.preparation
              ? "ASSESSMENT / PREPARATION"
              : state.responseRequired
                ? "RESPONSE REQUIRED"
                : state.proposal
                  ? "PAUSED FOR DECISION"
                  : state.hour >= STATION.playbackEnd
                    ? "CASE COMPLETE"
                    : "READY TO ADVANCE"}
          </span>
        }
      />
      <PreparationStatus />
      <div className="studio-playback">
        <div>
          <span className="studio-eyebrow">OPERATING CLOCK</span>
          <strong>
            H{state.hour}:{String(state.minute ?? 0).padStart(2, "0")}
            <small>{stationTime(stationHour(state))}</small>
          </strong>
        </div>
        <div className="studio-action-row">
          <button
            className="studio-button secondary"
            disabled={paused || !!playbackBlock(state)}
            onClick={() => dispatch({ type: "advance", hours: 1 })}
          >
            +1 hour
          </button>
          <button
            className="studio-button secondary"
            disabled={paused || !!playbackBlock(state)}
            onClick={() => dispatch({ type: "advance", hours: 6 })}
          >
            +6 hours
          </button>
          <button
            className="studio-button"
            disabled={paused || !!playbackBlock(state) || state.hour >= state.inputs.weatherHour}
            onClick={() =>
              dispatch({
                type: "advance-minutes",
                minutes: (state.inputs.weatherHour - state.hour) * 60 - (state.minute ?? 0),
              })
            }
          >
            To weather checkpoint
          </button>
          <button
            className="studio-button secondary"
            disabled={paused || !!playbackBlock(state) || state.hour >= 26}
            onClick={() =>
              dispatch({
                type: "advance-minutes",
                minutes: (26 - state.hour) * 60 - (state.minute ?? 0),
              })
            }
          >
            To asset checkpoint
          </button>
        </div>
        <span className="studio-playback-note">
          {state.proposal
            ? "Review, activate or reject the revision before continuing."
            : state.responseRequired
              ? "Open Mission Planner to assess a response before continuing."
              : state.preparation
                ? "Preparation in progress; operating clock retained."
                : `${state.playback.reason}. Click the header clock to play/pause; Shift-click for simulation controls.`}
        </span>
      </div>
      <div className="studio-kpi-grid">
        <Metric
          label="Critical station service"
          value={c.criticalServed ? "Protected" : "Shortfall"}
          detail={`${STATION.criticalLoad} kW protected demand`}
          icon={ShieldCheck}
          accent="mint"
        />
        <Metric
          label="Generator 01 capability"
          value={`${c.g1Capacity} kW`}
          detail={
            state.derated
              ? `${STATION.generatorOne - c.g1Capacity} kW below nameplate capacity`
              : "Nameplate capacity available"
          }
          icon={Zap}
          accent={state.derated ? "amber" : "cyan"}
        />
        <Metric
          label="Battery above reserve"
          value={`${format(c.battery - STATION.batteryReserve)} kWh`}
          detail={`${format(c.battery)} kWh stored energy`}
          icon={BatteryCharging}
          accent="violet"
        />
        <Metric
          label="Observed fuel inventory"
          value={`${format(c.fuel)} L`}
          detail={`Through H${state.hour} · resource continuity retained`}
          icon={Fuel}
          accent="cyan"
        />
      </div>
      <div className="recording-monitor-events">
        <span>Observed events</span>
        <button
          className="studio-button secondary"
          disabled={
            paused ||
            !!state.observedWeather ||
            state.hour < state.inputs.weatherHour ||
            state.inputs.weatherSeverity === 0
          }
          onClick={() => dispatch({ type: "observe-weather" })}
        >
          {state.observedWeather ? "Weather recorded" : "Observe weather event"}
        </button>
        <small>
          {state.hour < state.inputs.weatherHour
            ? "Weather observation becomes available when the scenario conditions arrive."
            : "Events update current observations; earlier intervals remain fixed."}
        </small>
      </div>
      <MissionIssueReporting />
      <div className="studio-planner-grid">
        <div className="studio-stack">
          <Panel
            title="Generator 01 · observed vs pre-event reference"
            meta={<span className="studio-unit">kW</span>}
          >
            {
              <div
                className="studio-deviation-chart"
                role="img"
                aria-label="Generator 01 observed output versus pre-event reference in kW"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={points} margin={{ left: -15, right: 20, top: 16 }}>
                    <CartesianGrid stroke="#25404b" strokeDasharray="3 5" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(h) => stationTime(h).replace(" UTC", "")}
                      tick={{ fill: "#91a7b5", fontSize: 11 }}
                      minTickGap={65}
                    />
                    <YAxis tick={{ fill: "#91a7b5", fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(v) => `${stationTime(Number(v))} · kW`}
                      contentStyle={{ background: "#11212d", borderColor: "#34505e", fontSize: 12 }}
                    />
                    <Line
                      dataKey="expected"
                      name="Pre-event reference"
                      stroke="#a2adbd"
                      strokeDasharray="5 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      dataKey="observed"
                      name="Observed output"
                      stroke="#55d3e4"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <ReferenceLine
                      x={0}
                      stroke="#91a7b5"
                      strokeDasharray="3 4"
                      label={{ value: "Case H0", fill: "#91a7b5", fontSize: 10 }}
                    />
                    {state.generatorEvent && (
                      <ReferenceLine
                        x={state.generatorEvent.hour}
                        stroke="#edb45f"
                        label={{ value: "Capacity loss", fill: "#edb45f", fontSize: 10 }}
                      />
                    )}
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            }
            <small className="studio-footnote">
              48h prior station operation · issued-plan reference starts at H0.
            </small>
          </Panel>
          <div className="studio-small-multiples">
            <Panel title="Observed battery" meta={<span className="studio-unit">kWh</span>}>
              <Chart rows={observed} mode="battery" height={120} />
            </Panel>
            <Panel title="Observed fuel" meta={<span className="studio-unit">L</span>}>
              <Chart rows={observed} mode="fuel" height={120} />
            </Panel>
          </div>
          <Panel title="Mission execution">
            <MissionTimeline kind={state.activeKind} compact execution />
          </Panel>
        </div>
        <div className="studio-stack">
          <Panel title="Planning response">
            <DecisionLink />
          </Panel>
          <MissionActivity />
          <Panel title="Active conditions">
            <AttentionQueue scope="monitoring" compact />
          </Panel>
          <Panel
            title="Event history"
            meta={<span className="studio-unit">{state.records.length} records</span>}
          >
            <div className="studio-event-history">
              {[...state.records].reverse().map((r) => (
                <div key={r.id}>
                  <span>
                    H{r.hour}:{String(r.minute ?? 0).padStart(2, "0")}
                  </span>
                  <div>
                    <strong>{r.title}</strong>
                    <small>{r.detail}</small>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Assets() {
  const { state } = usePresentation();
  const [asset, setAsset] = useState("DG-01");
  const c = currentStation(state);
  return (
    <>
      <PageTitle
        eyebrow="CAPABILITY & RESOURCE ASSIGNMENT"
        title="Energy & Assets"
        subtitle="Available capacity, protected demand and shared mission resources."
      />
      <div className="studio-kpi-grid">
        <Metric
          label="Diesel capacity available"
          value={`${c.g1Capacity + STATION.generatorTwo} kW`}
          detail="Two-generator station configuration"
          icon={Zap}
          accent="cyan"
        />
        <Metric
          label="Renewable contribution"
          value={`${format(c.renewable, 1)} kW`}
          detail={`${format((c.renewable / Math.max(1, c.renewable + c.generator + c.discharge)) * 100)}% of current supply`}
          icon={Wind}
          accent="mint"
        />
        <Metric
          label="Mission demand"
          value={`${format(c.missionPower)} kW`}
          detail="From the active operating schedule"
          icon={Activity}
          accent="violet"
        />
        <Metric
          label="Battery energy"
          value={`${format(c.battery)} kWh`}
          detail="400 kWh capacity · 100 kWh protected reserve"
          icon={BatteryCharging}
          accent="cyan"
        />
      </div>
      <div className="studio-planner-grid">
        <div className="studio-stack">
          <Panel title="Asset capability">
            <AssetMatrix />
            <div className="studio-action-row">
              {["DG-01", "DG-02", "BESS"].map((a) => (
                <button
                  key={a}
                  className={`studio-button ${asset === a ? "" : "secondary"}`}
                  onClick={() => setAsset(a)}
                >
                  {a === "BESS"
                    ? "Battery storage"
                    : a === "DG-01"
                      ? "Generator 01"
                      : "Generator 02"}
                </button>
              ))}
            </div>
            <div className="studio-asset-detail">
              <strong>
                {asset === "BESS"
                  ? "Battery energy storage"
                  : asset === "DG-01"
                    ? "Generator 01"
                    : "Generator 02"}
              </strong>
              <p>
                {asset === "BESS"
                  ? "400 kWh configured capacity. Charging and discharge respect reserve and efficiency limits in the illustrative station model."
                  : asset === "DG-01" && state.derated
                    ? `Observed derating at H${state.generatorEvent?.hour}: available capacity ${c.g1Capacity} kW, compared with ${STATION.generatorOne} kW nameplate. Remaining work is assessed before a replacement can be authorized.`
                    : "Available station generator. Output follows modeled demand, renewable contribution and battery dispatch."}
              </p>
            </div>
          </Panel>
          <Panel title="Current station supply">
            <Chart rows={stationTrajectory(state, state.activeKind, false, 48)} height={240} />
          </Panel>
        </div>
        <div className="studio-stack">
          <Panel title="Shared equipment & personnel">
            {[
              {
                name: "Field team",
                resource: "Tracked vehicle · field kit",
                missions: "Coastal sampling",
              },
              {
                name: "Instrument team",
                resource: "Lidar · laboratory instruments",
                missions: "Atmospheric study / processing / calibration",
              },
              {
                name: "Utility operator",
                resource: "Water-production plant",
                missions: "Water-production run",
              },
            ].map((r) => {
              const assigned = state.activeSchedule.filter((m) => m.resource.startsWith(r.name));
              const running = assigned.filter((m) => c.runningMissions.includes(m.id));
              const upcoming = assigned.filter(
                (m) =>
                  !m.deferred && m.start >= state.hour && missionProgress(state, m) !== "Completed",
              );
              const conflicts = conflictCount(
                assigned.filter((m) => !m.deferred && m.start + m.duration > state.hour),
              );
              return (
                <div className="studio-resource-assignment" key={r.name}>
                  <strong>
                    {r.name}
                    <span className={`studio-chip ${conflicts ? "warn" : "good"}`}>
                      {conflicts
                        ? "Review"
                        : running.length
                          ? "In use"
                          : upcoming.length
                            ? "Reserved"
                            : "Available"}
                    </span>
                  </strong>
                  <small>{r.resource}</small>
                  <span>
                    {running.length
                      ? running.map((m) => m.short).join(" / ")
                      : upcoming.length
                        ? `Next: ${upcoming.sort((a, b) => a.start - b.start)[0]!.short} · H${upcoming[0]!.start}`
                        : "No remaining mission commitments"}
                  </span>
                </div>
              );
            })}
          </Panel>
          <Panel title="Station load composition">
            <div className="studio-load-breakdown">
              {[
                { name: "Critical service", value: STATION.criticalLoad, color: "#62d5ae" },
                {
                  name: "Other station demand",
                  value: c.demand - c.missionPower - STATION.criticalLoad,
                  color: "#4298c9",
                },
                { name: "Mission work", value: c.missionPower, color: "#a79bff" },
              ].map((l) => (
                <div key={l.name}>
                  <span>{l.name}</span>
                  <strong>{format(l.value, 1)} kW</strong>
                  <div>
                    <i style={{ width: `${(l.value / c.demand) * 100}%`, background: l.color }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Protected limits">
            <ConstraintList />
          </Panel>
        </div>
      </div>
    </>
  );
}

function Decisions() {
  const { state } = usePresentation();
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const records = [...state.records]
    .reverse()
    .filter(
      (r) =>
        (version === "all" || r.version === Number(version)) &&
        `${r.title} ${r.detail} ${r.type}`.toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <>
      <PageTitle
        eyebrow="TRACEABILITY & OPERATOR AUTHORITY"
        title="Decision Log"
        subtitle="Every assumption change, proposal and operator decision retained in sequence."
      />
      <div className="studio-record-summary">
        <div>
          <span>Active plan</span>
          <strong>V{state.activeVersion}</strong>
        </div>
        <div>
          <span>Operating time</span>
          <strong>
            H{state.hour}:{String(state.minute ?? 0).padStart(2, "0")}
          </strong>
        </div>
        <div>
          <span>Retained records</span>
          <strong>{state.records.length}</strong>
        </div>
        <div>
          <span>Authorization</span>
          <strong>Operator-controlled</strong>
        </div>
      </div>
      <div className="studio-record-filters">
        <label>
          <Search size={16} />
          <input
            aria-label="Search decision records"
            placeholder="Search trigger, decision or event…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter plan version"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        >
          <option value="all">All plan versions</option>
          {[...new Set(state.records.map((r) => r.version))].map((v) => (
            <option key={v} value={v}>
              Plan V{v}
            </option>
          ))}
        </select>
      </div>
      <Panel
        title="Decision timeline"
        meta={<span className="studio-unit">{records.length} matching records</span>}
      >
        <div className="studio-decision-timeline">
          {records.map((r) => (
            <article key={r.id}>
              <div className="studio-record-time">
                <strong>
                  H{r.hour}:{String(r.minute ?? 0).padStart(2, "0")}
                </strong>
                <small>{stationTime(r.hour + (r.minute ?? 0) / 60)}</small>
              </div>
              <div className="studio-record-marker">
                <i />
              </div>
              <div className="studio-record-content">
                <button
                  onClick={() => setSelected(selected === r.id ? null : r.id)}
                  aria-expanded={selected === r.id}
                >
                  <span>
                    <strong>{r.title}</strong>
                    <small>{r.detail}</small>
                  </span>
                  <span className="studio-chip">
                    V{r.version} · {r.type}
                  </span>
                </button>
                {selected === r.id && (
                  <div className="studio-record-detail">
                    Record {r.id} · browser-local workspace ·{" "}
                    {r.sync === "acknowledged" ? "Mock receiver acknowledged" : r.sync}
                    <br />
                    No hardware command or backend transaction was issued.
                  </div>
                )}
              </div>
            </article>
          ))}
          {!records.length && (
            <p className="studio-empty-inline">No records match these filters.</p>
          )}
        </div>
      </Panel>
    </>
  );
}
