// Generated artifacts only; the UI and exporter import the same pure model.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import * as m from "../src/lib/presentation-model.ts";
import * as w from "../src/lib/recording-workflow.ts";

let state = w.initializeWorkflow();
const checkpoints = [];
function capture(name) {
  const future = m.stationTrajectory(w.forecastCase(state), state.activeKind, false, 144);
  checkpoints.push({
    name,
    hour: state.hour,
    timestamp: m.stationTime(state.hour),
    assumptions: state.inputs,
    publishedInputs: w.forecastCase(state).inputs,
    activeVersion: state.activeVersion,
    activeKind: state.activeKind,
    current: m.currentStation(state),
    activeSchedule: state.activeSchedule,
    proposal: state.proposal,
    preparation: state.preparation,
    attention: state.attention,
    forecastReadyBasis: state.forecastReadyBasis,
    outlook: m.resourceOutlook(w.forecastCase(state), state.activeKind),
    adverseLimits: m.planAssessment(state, state.activeSchedule, state.activeKind),
    missions: state.activeSchedule.map((p) => ({ id: p.id, status: m.missionProgress(state, p) })),
    observed: state.observations,
    projection: future,
    forecast: m.forecastRows(w.forecastCase(state), 144),
    connectivity: {
      uplink: state.uplink,
      forecastHour: state.externalForecastHour,
      acknowledgedHour: state.lastAcknowledgedHour,
      queued: state.records.filter((r) => r.sync === "queued").length,
    },
    records: state.records,
  });
}
function action(type, extra = {}) {
  state = w.workflowReducer(state, { type, ...extra });
}
function complete() {
  const task = state.preparation;
  if (!task) throw Error("No preparation pending");
  action("complete-task", { token: task.token, elapsedMs: w.PREPARATION_MS[task.kind] });
}
function authorize() {
  if (!state.proposal?.feasible) throw Error("Recording branch has no feasible proposal");
  for (const type of ["review", "approve", "activate"]) action(type);
}
capture("baseline-original");
action("apply-outlook");
capture("future-inputs-received-forecast-preparing");
complete();
capture("forecast-ready-active-v1");
action("generate");
capture("joint-proposal-preparing");
complete();
capture("weather-joint-proposed");
authorize();
capture("weather-joint-active");
action("advance", { hours: 24 });
action("observe-weather");
capture("weather-observed");
action("advance", { hours: 2 });
action("generator-event");
capture("generator-observed-assessment-preparing");
complete();
capture("generator-response-required");
action("uplink");
action("generate");
capture("adaptive-proposal-preparing");
complete();
capture("adaptive-proposal-ready");
authorize();
capture("adaptive-active-link-lost");
action("advance", { hours: 22 });
capture("continued-operation");
action("uplink");
action("synchronize");
capture("decisions-acknowledged");
action("receive-forecast");
capture("forecast-received");
for (const point of state.observations) {
  if (
    Math.abs(
      point.renewable +
        point.generator +
        point.discharge +
        point.unserved -
        point.demand -
        point.charge,
    ) > 0.01
  )
    throw Error(`Power imbalance H${point.hour}`);
  if (
    point.battery < m.STATION.batteryReserve ||
    point.battery > m.STATION.batteryCapacity ||
    point.fuel < 0
  )
    throw Error(`Invalid resource H${point.hour}`);
}
const result = {
  schema: 3,
  preparationPacing: w.PREPARATION_MS,
  case: "Fictional coastal summer station / Alpha",
  config: m.STATION,
  checkpoints,
};
const outputFlag = process.argv.indexOf("--output");
if (outputFlag >= 0) {
  if (!process.argv[outputFlag + 1]) throw Error("--output requires a path");
  const target = resolve(process.argv[outputFlag + 1]);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(result, null, 2) + "\n");
  console.log(`Generated ${target}`);
} else console.log(JSON.stringify(result, null, 2));
if (outputFlag >= 0)
  console.table(
    checkpoints.map((c) => ({
      checkpoint: c.name,
      hour: c.hour,
      plan: c.activeVersion,
      battery: c.current.battery,
      fuel: c.current.fuel,
      fuelAtArrival: c.outlook.fuelAtResupply,
      queued: c.connectivity.queued,
    })),
  );
