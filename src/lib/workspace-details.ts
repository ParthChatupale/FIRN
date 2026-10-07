/** Read-only documentation derived from the same model as the operating screens. */
import {
  currentStation,
  missionProgress,
  planAssessment,
  RECORDING_INPUTS,
  resourceOutlook,
  stationHour,
  stationTime,
  STATION,
} from "./recording-engine.ts";
import {
  initializeWorkflow,
  PREPARATION_MS,
  workflowReducer,
  type WorkflowState,
} from "./recording-workflow.ts";

export function workspaceDetails(state: WorkflowState) {
  const current = currentStation(state);
  return {
    timestamp: stationTime(stationHour(state)),
    activeVersion: state.activeVersion,
    proposal: state.proposal ? `V${state.proposal.version} · ${state.proposal.status}` : "None",
    completed: state.activeSchedule.filter((m) => missionProgress(state, m) === "Completed").length,
    deferred: state.activeSchedule.filter((m) => m.deferred).length,
    total: state.activeSchedule.length,
    battery: current.battery,
    fuel: current.fuel,
    generatorCapacity: current.g1Capacity,
    arrival: stationTime(STATION.resupplyHour + state.inputs.resupplyDelay * 24),
    weatherObserved: !!state.observedWeather,
    issueReports: state.missionIssueReports?.length ?? 0,
    records: state.records.length,
  };
}

function complete(state: WorkflowState) {
  const task = state.preparation;
  if (!task) throw new Error("Example case has no preparation to complete");
  return workflowReducer(state, {
    type: "complete-task",
    token: task.token,
    elapsedMs: PREPARATION_MS[task.kind],
  });
}

function authorize(state: WorkflowState) {
  if (!state.proposal?.feasible) throw new Error("Cannot authorize an infeasible example");
  for (const type of ["review", "approve", "activate"] as const)
    state = workflowReducer(state, { type });
  return state;
}

function summarize(
  id: string,
  title: string,
  question: string,
  detail: string,
  state: WorkflowState,
  stage: "projection" | "execution" | "no-go",
) {
  const kind = state.proposal?.kind ?? state.activeKind;
  const schedule = state.proposal?.schedule ?? state.activeSchedule;
  const assessment = planAssessment(state, schedule, kind);
  return {
    id,
    title,
    question,
    detail,
    stage,
    feasible: assessment.feasible,
    scheduled: schedule.filter((m) => !m.deferred).length,
    deferred: schedule.filter((m) => m.deferred).map((m) => m.short),
    completed: workspaceDetails(state).completed,
    generatorCapacity: currentStation(state).g1Capacity,
    fuelAtResupply: resourceOutlook(state, kind).fuelAtResupply,
    reserveMargin: assessment.minimumBattery - STATION.batteryReserve,
    problems: assessment.problems,
    timestamp: stationTime(stationHour(state)),
  };
}

/** Isolated examples: never read, dispatch into, restore, or overwrite the user's case. */
export function buildCaseStudies() {
  const baseline = authorize(complete(workflowReducer(initializeWorkflow(), { type: "generate" })));
  let storm = complete(
    workflowReducer(initializeWorkflow(), { type: "apply-outlook", inputs: RECORDING_INPUTS }),
  );
  storm = authorize(complete(workflowReducer(storm, { type: "generate" })));
  let checkpoint = workflowReducer(storm, { type: "advance", hours: 24 });
  checkpoint = workflowReducer(checkpoint, { type: "observe-weather" });
  checkpoint = workflowReducer(checkpoint, { type: "advance", hours: 2 });
  let severe = complete(workflowReducer(checkpoint, { type: "generator-event", capacity: 10 }));
  severe = authorize(complete(workflowReducer(severe, { type: "generate" })));
  severe = workflowReducer(severe, { type: "advance", hours: 22 });
  const outage = complete(workflowReducer(checkpoint, { type: "generator-event", capacity: 0 }));
  const noGo = complete(workflowReducer(outage, { type: "generate" }));
  return [
    summarize(
      "baseline",
      "Coordinate the original commitments",
      "Enough power is not enough if the same team is booked twice.",
      "Under baseline assumptions, a joint proposal coordinates the shared instrument team without deferring a mission. This is a planning projection, not completed field work.",
      baseline,
      "projection",
    ),
    summarize(
      "storm",
      "Storm front + delayed resupply",
      "What changes when usable renewable power falls and fuel must last longer?",
      "A storm forecast and three-day resupply delay produce a revised joint schedule. All six missions remain scheduled in this example, subject to the configured adverse-case checks and operator authorization.",
      storm,
      "projection",
    ),
    summarize(
      "capacity-loss",
      "Independent generator capacity loss",
      "Which commitments can still be supplied with less generation available?",
      "After modeled weather is observed, Generator 01 is separately reduced from 80 to 10 kW. Generator 02 remains available at 45 kW. The operator-authorized response defers calibration, retains completed work and supplies the remaining sample-preservation mission.",
      severe,
      "execution",
    ),
    summarize(
      "full-loss",
      "When a response is not feasible",
      "A useful planner must also show when its constraints cannot be met.",
      "In the same storm branch, full loss of Generator 01 produces an infeasible proposal under the configured adverse assumptions. Approval is blocked; the model does not invent a successful replacement.",
      noGo,
      "no-go",
    ),
  ];
}
