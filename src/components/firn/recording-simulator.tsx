import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { ArrowUpRight, CloudSnow, Fuel, RotateCcw, Zap } from "lucide-react";
import { usePresentation } from "@/lib/presentation-context";
import { forecastCase } from "@/lib/recording-workflow";
import {
  arrivalHour,
  currentStation,
  environmentalPoint,
  planAssessment,
  stationTrajectory,
  stationTime,
  STATION,
  RECORDING_INPUTS,
  BASE_INPUTS,
  type ScenarioInputs,
} from "@/lib/presentation-model";
import {
  Chart,
  format,
  MissionTimeline,
  Panel,
  PageTitle,
  ValuesTable,
} from "./presentation-visuals";

export function RecordingSimulator() {
  const { state, dispatch } = usePresentation();
  const [draft, setDraft] = useState<ScenarioInputs>(() => ({ ...state.inputs }));
  const [view, setView] = useState("power");
  const [basis, setBasis] = useState("applied");
  const [horizon, setHorizon] = useState(48);
  const [adverse, setAdverse] = useState(false);
  const [capacity, setCapacity] = useState(10);
  const [reset, setReset] = useState(false);
  const c = currentStation(state);
  const preview = { ...state, inputs: draft };
  const selected = basis === "preview" ? preview : forecastCase(state);
  const rows =
    basis === "observed"
      ? state.observations
      : stationTrajectory(selected, state.activeKind, false, Math.max(state.hour, horizon));
  const weather = rows.map((p) => ({
    hour: p.hour,
    ...(basis === "observed"
      ? { wind: p.wind, temperature: p.temperature, visibility: p.visibility }
      : environmentalPoint(p.hour, selected.inputs, adverse)),
  }));
  const before = stationTrajectory(state, state.activeKind, false, arrivalHour(state) - 1).at(-1)!;
  const after = stationTrajectory(preview, state.activeKind, false, arrivalHour(preview) - 1).at(
    -1,
  )!;
  const assessment = planAssessment(preview, state.activeSchedule, state.activeKind);
  const edited = JSON.stringify(draft) !== JSON.stringify(state.inputs);
  const set = (key: keyof ScenarioInputs, value: number) => setDraft({ ...draft, [key]: value });
  return (
    <>
      <PageTitle
        eyebrow="OPERATING CASE / WHAT-IF WORKSPACE"
        title="Scenario Simulator"
        action={
          <button className="studio-button secondary" onClick={() => setReset(true)}>
            <RotateCcw size={15} />
            Reset case
          </button>
        }
      />
      {reset && (
        <div className="studio-reset-confirm" role="alert">
          <span>
            Reset this recording case and its browser-local decisions? Database records are
            untouched.
          </span>
          <button
            className="studio-button"
            onClick={() => {
              dispatch({ type: "reset" });
              setDraft({ ...BASE_INPUTS });
              setReset(false);
            }}
          >
            Reset case
          </button>
          <button className="studio-button quiet" onClick={() => setReset(false)}>
            Cancel
          </button>
        </div>
      )}
      <div className="recording-current-strip">
        <div>
          <small>COASTAL SUMMER / ALPHA</small>
          <strong>{stationTime(state.hour)}</strong>
          <span>Current observations · V{state.activeVersion}</span>
        </div>
        <div>
          <small>Station demand</small>
          <strong>
            {format(c.demand, 1)} <em>kW</em>
          </strong>
          <span>{format(c.missionPower)} kW mission work</span>
        </div>
        <div>
          <small>Wind / temperature</small>
          <strong>
            {format(c.wind, 1)} <em>km/h</em>
          </strong>
          <span>
            {format(c.temperature, 1)}°C · {format(c.visibility, 1)} km visibility
          </span>
        </div>
        <div>
          <small>Stored energy</small>
          <strong>
            {format(c.battery)} <em>kWh</em>
          </strong>
          <span>{format((c.battery / STATION.batteryCapacity) * 100)}% SOC</span>
        </div>
        <div>
          <small>Fuel on hand</small>
          <strong>
            {format(c.fuel)} <em>L</em>
          </strong>
          <span>{format(c.fuelRate, 1)} L/h current use</span>
        </div>
      </div>
      <div className="recording-workbench">
        <div className="studio-stack">
          <Panel
            title="Station response"
            meta={
              <select
                aria-label="Plot horizon"
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
              >
                {[48, 72, 144].map((h) => (
                  <option key={h} value={h}>
                    {h}h horizon
                  </option>
                ))}
              </select>
            }
          >
            <div className="recording-chart-toolbar">
              <div className="studio-segmented">
                {(
                  [
                    ["preview", "Input preview"],
                    ["applied", "Applied outlook"],
                    ["observed", "Observed history"],
                  ] as const
                ).map(([id, name]) => (
                  <button
                    key={id}
                    aria-pressed={basis === id}
                    className={basis === id ? "selected" : ""}
                    onClick={() => setBasis(id)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="studio-segmented">
                {["power", "weather", "resources", "missions"].map((v) => (
                  <button
                    key={v}
                    aria-pressed={view === v}
                    className={view === v ? "selected" : ""}
                    onClick={() => setView(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="studio-chart-meta">
              <strong>
                {basis === "observed"
                  ? "Recorded station intervals"
                  : basis === "preview"
                    ? "Active schedule under draft inputs"
                    : "Active schedule under applied inputs"}
              </strong>
              <span>
                {basis === "observed"
                  ? `Through H${state.hour}`
                  : `Assumptions ${state.assumptionVersion}${edited && basis === "preview" ? " / draft" : ""}`}
              </span>
            </div>
            {view === "power" ? (
              basis === "observed" && state.hour === 0 ? (
                <div className="studio-opening-state">
                  <Zap size={22} />
                  <strong>One opening observation</strong>
                  <span>
                    Use input preview for the future horizon; advance the clock to record history.
                  </span>
                </div>
              ) : (
                <Chart
                  rows={rows}
                  height={245}
                  event={selected.inputs.weatherSeverity > 0 ? selected.inputs.weatherHour : false}
                />
              )
            ) : view === "weather" ? (
              <>
                {basis !== "observed" && (
                  <label className="recording-checkbox">
                    <input
                      type="checkbox"
                      checked={adverse}
                      onChange={(e) => setAdverse(e.target.checked)}
                    />
                    Adverse weather assumptions
                  </label>
                )}
                <div
                  className="recording-weather-chart"
                  role="img"
                  aria-label="Wind in kilometres per hour and air temperature in degrees Celsius"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={weather} margin={{ left: -8, right: 8, top: 12 }}>
                      <CartesianGrid stroke="#25404b" strokeDasharray="3 5" vertical={false} />
                      <XAxis
                        dataKey="hour"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(h) => `H${h}`}
                        tick={{ fill: "#91a7b5", fontSize: 10 }}
                      />
                      <YAxis
                        yAxisId="wind"
                        domain={[0, 100]}
                        tick={{ fill: "#62d5ae", fontSize: 10 }}
                      />
                      <YAxis
                        yAxisId="temperature"
                        orientation="right"
                        domain={[-25, 0]}
                        tick={{ fill: "#c9b4ff", fontSize: 10 }}
                      />
                      <Tooltip contentStyle={{ background: "#11212d", borderColor: "#34505e" }} />
                      <Line
                        yAxisId="wind"
                        dataKey="wind"
                        name="Wind · km/h"
                        stroke="#62d5ae"
                        dot={weather.length === 1}
                        isAnimationActive={false}
                      />
                      <Line
                        yAxisId="temperature"
                        dataKey="temperature"
                        name="Temperature · °C"
                        stroke="#c9b4ff"
                        dot={weather.length === 1}
                        isAnimationActive={false}
                      />
                      {basis !== "observed" && (
                        <ReferenceLine
                          yAxisId="wind"
                          x={selected.inputs.weatherHour}
                          stroke="#edb45f"
                          strokeDasharray="4 4"
                        />
                      )}
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : view === "resources" ? (
              <div className="studio-small-multiples">
                <Panel title="Battery · kWh">
                  <Chart rows={rows} mode="battery" height={230} />
                </Panel>
                <Panel title="Fuel · L">
                  <Chart rows={rows} mode="fuel" height={230} />
                </Panel>
              </div>
            ) : (
              <MissionTimeline kind={state.activeKind} />
            )}
            <div className="recording-plot-foot">
              <span>
                Wind {STATION.windCapacity} kW · solar {STATION.solarCapacity} kW · diesel{" "}
                {c.g1Capacity + STATION.generatorTwo} kW
              </span>
              <span>Preview does not activate a plan</span>
            </div>
          </Panel>
          <div className="recording-impact-grid">
            <div>
              <small>Arrival / applied → draft</small>
              <strong>{stationTime(arrivalHour(state))}</strong>
              <span>→ {stationTime(arrivalHour(preview))}</span>
            </div>
            <div>
              <small>Fuel before resupply</small>
              <strong>
                {format(before.fuel - before.fuelRate)} → {format(after.fuel - after.fuelRate)} L
              </strong>
              <span>Same active mission schedule</span>
            </div>
            <div className={assessment.feasible ? "" : "warning"}>
              <small>Adverse-case limits</small>
              <strong>
                {assessment.feasible ? "Within configured limits" : "Review required"}
              </strong>
              <span>{assessment.problems[0] ?? `Fuel buffer ≥ ${STATION.protectedFuel} L`}</span>
            </div>
          </div>
          <Panel
            title="Observed event controls"
            meta={
              <Link to="/monitoring" className="studio-inline-link">
                Monitoring <ArrowUpRight size={14} />
              </Link>
            }
          >
            <div className="recording-event-grid">
              <div>
                <strong>
                  <CloudSnow size={16} />
                  Weather arrival
                </strong>
                <small>
                  {state.observedWeather
                    ? `Recorded ${stationTime(state.observedWeather.hour)}`
                    : `Available from ${stationTime(state.inputs.weatherHour)}`}
                </small>
                <button
                  className="studio-button secondary"
                  disabled={
                    !!state.proposal ||
                    !!state.preparation ||
                    !!state.observedWeather ||
                    state.hour < state.inputs.weatherHour ||
                    state.inputs.weatherSeverity === 0
                  }
                  onClick={() => dispatch({ type: "observe-weather" })}
                >
                  Observe weather event
                </button>
              </div>
              <div>
                <strong>
                  <Zap size={16} />
                  Independent generator event
                </strong>
                <label>
                  Generator 01 available kW
                  <select
                    aria-label="Generator event capacity"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                  >
                    <option value={10}>10 kW · severe derating</option>
                    <option value={25}>25 kW · moderate derating</option>
                    <option value={0}>0 kW · full outage</option>
                  </select>
                </label>
                <button
                  className="studio-button secondary"
                  disabled={
                    !!state.proposal ||
                    !!state.preparation ||
                    !!state.generatorEvent ||
                    state.hour < 26
                  }
                  onClick={() => dispatch({ type: "generator-event", capacity })}
                >
                  {state.generatorEvent ? "Event recorded" : "Apply capacity loss"}
                </button>
              </div>
            </div>
            <div className="studio-action-row">
              <button
                className="studio-button secondary"
                disabled={
                  !!state.proposal ||
                  !!state.preparation ||
                  state.responseRequired ||
                  state.hour >= STATION.playbackEnd
                }
                onClick={() => dispatch({ type: "advance", hours: 1 })}
              >
                +1 hour
              </button>
              <button
                className="studio-button secondary"
                disabled={
                  !!state.proposal ||
                  !!state.preparation ||
                  state.responseRequired ||
                  state.hour >= STATION.playbackEnd
                }
                onClick={() => dispatch({ type: "advance", hours: 6 })}
              >
                +6 hours
              </button>
              <span className="studio-footnote">
                Forecast inputs and observed events are separate. Pending proposals pause playback.
              </span>
            </div>
          </Panel>
          <ValuesTable rows={rows} />
        </div>
        <div className="studio-stack recording-inputs">
          <Panel
            title="Future operating inputs"
            meta={<span className="studio-chip">{edited ? "DRAFT" : "APPLIED"}</span>}
          >
            <div className="recording-input-group">
              <h3>
                <Fuel size={17} />
                Resupply delay
              </h3>
              <label>
                Additional delay<strong>+{draft.resupplyDelay} days</strong>
                <input
                  aria-label="Resupply delay days"
                  type="range"
                  min="0"
                  max="5"
                  step="1"
                  value={draft.resupplyDelay}
                  onChange={(e) => set("resupplyDelay", Number(e.target.value))}
                />
              </label>
              <div className="recording-dates">
                <span>
                  Original arrival<strong>{stationTime(STATION.resupplyHour)}</strong>
                </span>
                <span>
                  Revised arrival / draft<strong>{stationTime(arrivalHour(preview))}</strong>
                </span>
                <span>
                  Applied arrival<strong>{stationTime(arrivalHour(state))}</strong>
                </span>
              </div>
            </div>
            <div className="recording-input-group">
              <h3>
                <CloudSnow size={17} />
                Future weather condition
              </h3>
              <label>
                Condition
                <select
                  aria-label="Future weather condition"
                  value={draft.weatherSeverity}
                  onChange={(e) => set("weatherSeverity", Number(e.target.value))}
                >
                  <option value={0}>Baseline coastal conditions</option>
                  <option value={0.5}>Moderate weather front</option>
                  <option value={0.85}>Storm front</option>
                  <option value={1}>Severe storm front</option>
                  {![0, 0.5, 0.85, 1].includes(draft.weatherSeverity) && (
                    <option value={draft.weatherSeverity}>Custom front</option>
                  )}
                </select>
              </label>
              <label>
                Expected onset
                <select
                  aria-label="Weather onset hour"
                  value={draft.weatherHour}
                  onChange={(e) => set("weatherHour", Number(e.target.value))}
                >
                  {[18, 24, 30, 36].map((h) => (
                    <option value={h} key={h}>
                      {stationTime(h)} · H{h}
                    </option>
                  ))}
                </select>
              </label>
              <div className="recording-weather-deltas">
                {(
                  [
                    ["Wind", "wind", "km/h"],
                    ["Temperature", "temperature", "°C"],
                    ["Visibility", "visibility", "km"],
                    ["Renewables", "renewable", "kW"],
                  ] as const
                ).map(([name, key, unit]) => {
                  const original = environmentalPoint(draft.weatherHour, BASE_INPUTS),
                    revised = environmentalPoint(draft.weatherHour, draft);
                  return (
                    <div key={key}>
                      <span>{name} / baseline → draft</span>
                      <strong>
                        {format(original[key], 1)} → {format(revised[key], 1)} {unit}
                      </strong>
                    </div>
                  );
                })}
              </div>
              <details className="recording-advanced">
                <summary>Downside planning assumptions</summary>
                <label>
                  Renewable reduction in downside case
                  <strong>{format(draft.uncertainty * 100)}%</strong>
                  <input
                    aria-label="Downside renewable reduction percent"
                    type="range"
                    min="5"
                    max="40"
                    step="1"
                    value={draft.uncertainty * 100}
                    onChange={(e) => set("uncertainty", Number(e.target.value) / 100)}
                  />
                </label>
                <small>
                  Retains {format((1 - draft.uncertainty) * 100)}% of nominal renewable availability
                  before adverse weather adjustments. This also increases demand by{" "}
                  {format(draft.uncertainty * 12, 1)}% and slightly intensifies the front; not a
                  learned confidence interval.
                </small>
              </details>
            </div>
            <div className="studio-action-row">
              <button className="studio-button quiet" onClick={() => setDraft({ ...BASE_INPUTS })}>
                Baseline inputs
              </button>
              <button
                className="studio-button quiet"
                onClick={() => {
                  setDraft({ ...RECORDING_INPUTS });
                  setBasis("preview");
                }}
              >
                Storm + delayed resupply
              </button>
            </div>
            <button
              className="studio-button recording-apply"
              disabled={!edited || !!state.proposal || state.hour > 6}
              onClick={() => {
                dispatch({ type: "apply-outlook", inputs: draft });
                setBasis("applied");
              }}
            >
              Apply future assumptions <ArrowUpRight size={15} />
            </button>
            {state.hour > 6 && (
              <p className="studio-footnote">
                Opening input revisions close after H6. Reset for another branch; observed events
                remain independent.
              </p>
            )}
            <Link to="/mission-planner" className="studio-inline-link">
              Open planning workspace <ArrowUpRight size={14} />
            </Link>
          </Panel>
          <Panel title="Case state">
            <div className="studio-assumption-row">
              <span>Active schedule</span>
              <strong>
                V{state.activeVersion} / {state.activeKind}
              </strong>
            </div>
            <div className="studio-assumption-row">
              <span>Assumptions</span>
              <strong>Revision {state.assumptionVersion}</strong>
            </div>
            <div className="studio-assumption-row">
              <span>Active plan issued against</span>
              <strong>
                Arrival{" "}
                {stationTime(
                  STATION.resupplyHour + state.activations.at(-1)!.inputs.resupplyDelay * 24,
                )}
              </strong>
            </div>
            <div className="studio-assumption-row">
              <span>Observed intervals</span>
              <strong>{state.hour} completed</strong>
            </div>
            <div className="studio-assumption-row">
              <span>Operator decision</span>
              <strong>
                {state.proposal
                  ? `V${state.proposal.version} / ${state.proposal.status}`
                  : "None pending"}
              </strong>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
