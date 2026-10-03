/** Fictional, deterministic recording case. No backend, trained model or hardware calls. */
export type PlanKind = "original" | "energy" | "joint" | "weather" | "adaptive";
export type DecisionStatus = "proposed" | "reviewed" | "approved";
export type ScenarioInputs = {
  resupplyDelay: number;
  weatherSeverity: number;
  weatherHour: number;
  uncertainty: number;
};
export type Mission = {
  id: string;
  name: string;
  short: string;
  start: number;
  duration: number;
  power: number;
  priority: string;
  resource: string;
  earliest: number;
  deadline: number;
  deferred?: boolean;
};
export type Proposal = {
  version: number;
  kind: PlanKind;
  status: DecisionStatus;
  trigger: string;
  schedule: Mission[];
  feasible: boolean;
  problems: string[];
  minimumBattery: number;
  minimumFuel: number;
  basis: number;
};
export type RecordItem = {
  id: string;
  hour: number;
  type: string;
  title: string;
  detail: string;
  version: number;
  sync: "local" | "queued" | "acknowledged";
};
export type StationPoint = {
  hour: number;
  demand: number;
  renewable: number;
  availableRenewable: number;
  generator: number;
  g1: number;
  g2: number;
  g1Capacity: number;
  charge: number;
  discharge: number;
  battery: number;
  fuel: number;
  fuelRate: number;
  criticalServed: boolean;
  unserved: number;
  temperature: number;
  wind: number;
  visibility: number;
  missionPower: number;
  windPower: number;
  solarPower: number;
  runningMissions: string[];
  blockedMissions: string[];
  resourceHolds?: string[];
  curtailed: number;
};
export type PresentationState = {
  schema: 2;
  hour: number;
  inputs: ScenarioInputs;
  assumptionVersion: number;
  outlookChanged: boolean;
  derated: boolean;
  observedWeather: { hour: number; severity: number } | null;
  generatorEvent: { hour: number; capacity: number; reference: StationPoint[] } | null;
  activeVersion: number;
  activeKind: PlanKind;
  activeSchedule: Mission[];
  proposal: Proposal | null;
  observations: StationPoint[];
  activations: {
    hour: number;
    kind: PlanKind;
    version: number;
    schedule: Mission[];
    inputs: ScenarioInputs;
  }[];
  records: RecordItem[];
  uplink: "connected" | "lost";
  externalForecastHour: number;
  lastContactHour: number;
  lastAcknowledgedHour: number | null;
};
export type PresentationAction =
  | { type: "apply-outlook"; inputs?: ScenarioInputs }
  | { type: "observe-weather"; severity?: number }
  | { type: "generator-event"; capacity?: number }
  | { type: "generate"; kind?: PlanKind }
  | {
      type:
        | "review"
        | "approve"
        | "activate"
        | "reject"
        | "uplink"
        | "synchronize"
        | "receive-forecast"
        | "reset";
    }
  | { type: "advance"; hours: number };
export const PRESENTATION_KEY = "firn:presentation:v2";
export const STATION = {
  batteryCapacity: 400,
  batteryReserve: 100,
  initialBattery: 312,
  initialFuel: 1650,
  protectedFuel: 300,
  dieselRate: 0.25,
  criticalLoad: 32,
  generatorOne: 80,
  generatorTwo: 45,
  windCapacity: 60,
  solarCapacity: 50,
  resupplyHour: 72,
  deliveryLitres: 1800,
  playbackEnd: 48,
};
export const BASE_INPUTS: ScenarioInputs = {
  resupplyDelay: 0,
  weatherSeverity: 0,
  weatherHour: 24,
  uncertainty: 0.12,
};
export const RECORDING_INPUTS: ScenarioInputs = {
  resupplyDelay: 3,
  weatherSeverity: 0.85,
  weatherHour: 24,
  uncertainty: 0.3,
};
const kinds: PlanKind[] = ["original", "energy", "joint", "weather", "adaptive"];
const round = (v: number) => Math.round(v * 1000) / 1000;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export function validInputs(i: ScenarioInputs): boolean {
  return (
    !!i &&
    Number.isInteger(i.resupplyDelay) &&
    i.resupplyDelay >= 0 &&
    i.resupplyDelay <= 5 &&
    Number.isInteger(i.weatherHour) &&
    i.weatherHour >= 18 &&
    i.weatherHour <= 36 &&
    Number.isFinite(i.weatherSeverity) &&
    i.weatherSeverity >= 0 &&
    i.weatherSeverity <= 1 &&
    Number.isFinite(i.uncertainty) &&
    i.uncertainty >= 0.05 &&
    i.uncertainty <= 0.4
  );
}
export function arrivalHour(s: PresentationState) {
  return STATION.resupplyHour + s.inputs.resupplyDelay * 24;
}
export function activeCandidateKind(s: PresentationState): PlanKind {
  return s.derated ? "adaptive" : s.outlookChanged ? "weather" : "joint";
}

const baseMissions: Mission[] = [
  {
    id: "field",
    name: "Coastal field sampling",
    short: "Field sampling",
    start: 8,
    duration: 3,
    power: 18,
    priority: "High",
    resource: "Field team · tracked vehicle",
    earliest: 4,
    deadline: 12,
  },
  {
    id: "atmosphere",
    name: "Atmospheric observations",
    short: "Atmospheric study",
    start: 11,
    duration: 3,
    power: 12,
    priority: "High",
    resource: "Instrument team · lidar",
    earliest: 10,
    deadline: 17,
  },
  {
    id: "lab",
    name: "Laboratory processing",
    short: "Lab processing",
    start: 9,
    duration: 4,
    power: 28,
    priority: "Flexible",
    resource: "Instrument team · laboratory",
    earliest: 9,
    deadline: 23,
  },
  {
    id: "water",
    name: "Water production",
    short: "Water production",
    start: 20,
    duration: 2,
    power: 16,
    priority: "Essential",
    resource: "Utility operator · water plant",
    earliest: 18,
    deadline: 25,
  },
  {
    id: "survey",
    name: "Instrument calibration",
    short: "Calibration",
    start: 28,
    duration: 3,
    power: 32,
    priority: "Flexible",
    resource: "Instrument team · lidar",
    earliest: 28,
    deadline: 37,
  },
  {
    id: "samples",
    name: "Sample preservation",
    short: "Sample preservation",
    start: 29,
    duration: 3,
    power: 20,
    priority: "High",
    resource: "Instrument team · cold laboratory",
    earliest: 29,
    deadline: 40,
  },
];

/** Illustrative coastal-summer forcing; wind curve has cut-in/rated/cut-out, not monotonic storm output. */
export function environmentalPoint(hour: number, inputs: ScenarioInputs, adverse = false) {
  const front = hour >= inputs.weatherHour && hour < inputs.weatherHour + 30;
  const severity = front
    ? clamp(inputs.weatherSeverity + (adverse ? inputs.uncertainty * 0.25 : 0), 0, 1)
    : 0;
  const phase = (hour * Math.PI) / 12;
  const windMs = severity
    ? 11 + 13 * severity + 1.2 * Math.sin(hour / 3)
    : 8.5 + 1.4 * Math.sin(phase - 0.4);
  const cloud = clamp(0.28 + 0.07 * Math.sin(hour / 8) + severity * 0.68, 0.05, 0.98);
  const windPower =
    windMs < 3 || windMs >= 20
      ? 0
      : STATION.windCapacity * Math.min(1, (windMs ** 3 - 3 ** 3) / (11 ** 3 - 3 ** 3));
  const daylight = 0.2 + 0.8 * Math.max(0, Math.sin((((hour % 24) + 6) * Math.PI) / 12));
  const solarPower = STATION.solarCapacity * daylight * (1 - 0.85 * cloud) * 0.9;
  const temperature = -12 + 2 * Math.sin(hour / 5) - severity * 8;
  const stationDemand =
    (STATION.criticalLoad + 17 + 3 * Math.sin(phase + 0.5) + Math.max(0, -12 - temperature) * 1.8) *
    (adverse ? 1 + inputs.uncertainty * 0.12 : 1);
  const visibility = severity
    ? Math.max(0.5, 8 - severity * 8)
    : inputs.weatherSeverity > 0.5 && hour >= 10 && hour < 14
      ? 1.4
      : 12;
  return {
    wind: round(windMs * 3.6),
    temperature: round(temperature),
    visibility: round(visibility),
    windPower: round(windPower),
    solarPower: round(solarPower),
    renewable: round((windPower + solarPower) * (adverse ? 1 - inputs.uncertainty : 1)),
    stationDemand: round(stationDemand),
  };
}
function observedInputs(s: PresentationState, hour: number): ScenarioInputs {
  if (!s.observedWeather || hour < s.observedWeather.hour) return BASE_INPUTS;
  return {
    ...s.inputs,
    weatherSeverity: s.observedWeather.severity,
    weatherHour: s.observedWeather.hour,
  };
}
function weatherUsable(m: Mission, h: number, i: ScenarioInputs, adverse: boolean) {
  const e = environmentalPoint(h, i, adverse);
  return m.id !== "field" || (e.visibility >= 2 && e.wind <= 55);
}
export function fuelConsumption(g1: number, g2: number) {
  return (g1 > 0.001 ? 1.1 + 0.24 * g1 : 0) + (g2 > 0.001 ? 0.7 + 0.25 * g2 : 0);
}
function pointAt(
  s: PresentationState,
  h: number,
  battery: number,
  fuel: number,
  schedule: Mission[],
  kind: PlanKind,
  observed: boolean,
  adverse = false,
): StationPoint {
  const inputs = observed ? observedInputs(s, h) : s.inputs;
  const e = environmentalPoint(h, inputs, adverse);
  const planned = schedule.filter((m) => !m.deferred && h >= m.start && h < m.start + m.duration);
  const usable = planned.filter((m) => weatherUsable(m, h, inputs, adverse));
  const teams = new Set<string>();
  const priority: Record<string, number> = { Essential: 0, High: 1, Flexible: 2 };
  const running = observed
    ? [...usable]
        .sort((a, b) => priority[a.priority]! - priority[b.priority]!)
        .filter((m) => {
          const team = m.resource.split(" · ")[0]!;
          if (teams.has(team)) return false;
          teams.add(team);
          return true;
        })
    : usable;
  const missionPower = running.reduce((n, m) => n + m.power, 0);
  const demand = e.stationDemand + missionPower;
  const deficit = Math.max(0, demand - e.renewable);
  const cap =
    s.generatorEvent && h >= s.generatorEvent.hour
      ? s.generatorEvent.capacity
      : STATION.generatorOne;
  const chargeTarget =
    kind === "weather" || kind === "adaptive" ? 340 : kind === "original" ? 180 : 260;
  const peakThreshold = kind === "energy" ? 20 : kind === "original" ? 25 : 40;
  const desiredDischarge =
    deficit > peakThreshold && battery > chargeTarget
      ? Math.min(15, (battery - chargeTarget) * 0.94)
      : 0;
  const plannedCharge =
    deficit < 25 && battery < chargeTarget ? Math.min(10, (chargeTarget - battery) / 0.94) : 0;
  const desiredDiesel = Math.max(0, deficit + plannedCharge - desiredDischarge);
  const g1 = fuel > 1.1 ? Math.min(cap, desiredDiesel, (fuel - 1.1) / 0.24) : 0;
  const remainingFuel = fuel - fuelConsumption(g1, 0);
  const g2 =
    remainingFuel > 0.7
      ? Math.min(
          STATION.generatorTwo,
          Math.max(0, desiredDiesel - g1),
          (remainingFuel - 0.7) / 0.25,
        )
      : 0;
  const discharge = Math.min(
    30,
    Math.max(0, demand - e.renewable - g1 - g2),
    Math.max(0, battery - STATION.batteryReserve) * 0.94,
  );
  const charge = Math.min(
    25,
    Math.max(0, e.renewable + g1 + g2 - demand),
    (STATION.batteryCapacity - battery) / 0.94,
  );
  const renewable = Math.min(e.renewable, Math.max(0, demand + charge - g1 - g2 - discharge));
  const unserved = Math.max(0, demand + charge - renewable - g1 - g2 - discharge);
  return {
    hour: h,
    demand: round(demand),
    renewable: round(renewable),
    availableRenewable: e.renewable,
    generator: round(g1 + g2),
    g1: round(g1),
    g2: round(g2),
    g1Capacity: cap,
    charge: round(charge),
    discharge: round(discharge),
    battery: round(battery),
    fuel: round(fuel),
    fuelRate: round(fuelConsumption(g1, g2)),
    criticalServed: demand - unserved >= STATION.criticalLoad - 0.01,
    unserved: round(unserved),
    temperature: e.temperature,
    wind: e.wind,
    visibility: e.visibility,
    missionPower,
    windPower: e.windPower,
    solarPower: e.solarPower,
    runningMissions: running.map((m) => m.id),
    blockedMissions: planned.filter((m) => !usable.includes(m)).map((m) => m.id),
    resourceHolds: usable.filter((m) => !running.includes(m)).map((m) => m.id),
    curtailed: round(e.renewable - renewable),
  };
}
function nextInventory(p: StationPoint, s: PresentationState) {
  // Inventory at H+1 closes interval H; never debit the next interval's dispatch.
  return {
    battery: clamp(
      p.battery + p.charge * 0.94 - p.discharge / 0.94,
      STATION.batteryReserve,
      STATION.batteryCapacity,
    ),
    fuel:
      Math.max(0, p.fuel - p.fuelRate) +
      (p.hour + 1 === arrivalHour(s) ? STATION.deliveryLitres : 0),
  };
}
export function trajectoryForSchedule(
  s: PresentationState,
  schedule: Mission[],
  kind: PlanKind,
  horizon = 48,
  adverse = false,
): StationPoint[] {
  const history = s.observations.slice(0, s.hour);
  const opening = s.observations[s.hour];
  let battery = opening?.battery ?? STATION.initialBattery,
    fuel = opening?.fuel ?? STATION.initialFuel;
  const rows = [...history];
  for (let h = s.hour; h <= Math.max(s.hour, horizon); h++) {
    const p = pointAt(s, h, battery, fuel, schedule, kind, false, adverse);
    rows.push(p);
    ({ battery, fuel } = nextInventory(p, s));
  }
  return rows;
}
function overlap(a: Mission, b: Mission) {
  return (
    !a.deferred &&
    !b.deferred &&
    a.start < b.start + b.duration &&
    b.start < a.start + a.duration &&
    a.resource.split(" · ")[0] === b.resource.split(" · ")[0]
  );
}
export function conflictCount(schedule: Mission[]) {
  return schedule.reduce(
    (n, a, i) => n + schedule.slice(i + 1).filter((b) => overlap(a, b)).length,
    0,
  );
}
function executedHours(s: PresentationState, id: string) {
  return s.observations.filter(
    (p) => p.hour < s.hour && p.runningMissions.includes(id) && p.unserved < 0.01,
  ).length;
}
const scheduleCache = new WeakMap<PresentationState, Map<PlanKind, Mission[]>>();
/** Bounded priority-first schedule search, not the backend MILP. Outcomes are assessed, never guaranteed. */
export function candidateSchedule(s: PresentationState, kind: PlanKind): Mission[] {
  const cached = scheduleCache.get(s)?.get(kind);
  if (cached) return cached;
  if (kind === "original") return baseMissions.map((m) => ({ ...m }));
  const placed: Mission[] = [];
  const priority: Record<string, number> = { Essential: 0, High: 1, Flexible: 2 };
  for (const m of [...baseMissions].sort(
    (a, b) => priority[a.priority]! - priority[b.priority]! || a.deadline - b.deadline,
  )) {
    const done = executedHours(s, m.id);
    const active = s.activeSchedule.find((a) => a.id === m.id)!;
    if (done >= m.duration) {
      placed.push({ ...active });
      continue;
    }
    if (kind === "energy" && m.priority === "Flexible") {
      placed.push({ ...m, deferred: true });
      continue;
    }
    const duration = m.duration - done;
    let best: Mission | undefined,
      score = Infinity;
    for (let start = Math.max(m.earliest, s.hour); start + duration <= m.deadline; start++) {
      if (done && currentStation(s).runningMissions.includes(m.id) && start !== s.hour) continue;
      const candidate = { ...m, start, duration };
      if (placed.some((p) => overlap(candidate, p))) continue;
      if (
        Array.from({ length: duration }, (_, i) => start + i).some(
          (h) => !weatherUsable(m, h, s.inputs, true),
        )
      )
        continue;
      const rows = trajectoryForSchedule(s, [...placed, candidate], kind, 48, true);
      if (rows.slice(s.hour).some((p) => p.unserved > 0.01 || p.blockedMissions.length)) continue;
      const value =
        rows.slice(s.hour).reduce((n, p) => n + p.fuelRate, 0) * 0.3 +
        Math.abs(start - m.start) * 1.5;
      if (value < score) {
        score = value;
        best = candidate;
      }
    }
    placed.push(best ?? { ...m, deferred: true });
  }
  const result = baseMissions.map((m) => placed.find((p) => p.id === m.id)!);
  const map = scheduleCache.get(s) ?? new Map();
  map.set(kind, result);
  scheduleCache.set(s, map);
  return result;
}
export function missionSchedule(kind: PlanKind, state?: PresentationState): Mission[] {
  if (!state) return candidateSchedule(initialPresentation(), kind);
  if (state.proposal?.kind === kind) return state.proposal.schedule;
  if (state.activeKind === kind) return state.activeSchedule;
  return candidateSchedule(state, kind);
}
export function initialPresentation(): PresentationState {
  const schedule = baseMissions.map((m) => ({ ...m }));
  const s: PresentationState = {
    schema: 2,
    hour: 0,
    inputs: { ...BASE_INPUTS },
    assumptionVersion: 1,
    outlookChanged: false,
    derated: false,
    observedWeather: null,
    generatorEvent: null,
    activeVersion: 1,
    activeKind: "original",
    activeSchedule: schedule,
    proposal: null,
    observations: [],
    activations: [{ hour: 0, kind: "original", version: 1, schedule, inputs: { ...BASE_INPUTS } }],
    uplink: "connected",
    externalForecastHour: 0,
    lastContactHour: 0,
    lastAcknowledgedHour: null,
    records: [
      {
        id: "record-1",
        hour: 0,
        type: "case",
        title: "Station case prepared",
        detail: "Original mission schedule retained for joint-planning comparison.",
        version: 1,
        sync: "local",
      },
    ],
  };
  s.observations = [
    pointAt(s, 0, STATION.initialBattery, STATION.initialFuel, schedule, "original", true),
  ];
  return s;
}
export function stationTrajectory(
  s: PresentationState,
  kind: PlanKind = s.activeKind,
  observed = false,
  horizon = 48,
): StationPoint[] {
  if (observed) return s.observations.slice(0, Math.min(s.hour, horizon) + 1);
  return trajectoryForSchedule(s, missionSchedule(kind, s), kind, horizon);
}
export function currentStation(s: PresentationState) {
  return s.observations[s.hour]!;
}
export function planAssessment(s: PresentationState, schedule: Mission[], kind: PlanKind) {
  const rows = trajectoryForSchedule(
    s,
    schedule,
    kind,
    Math.max(48, arrivalHour(s) - 1),
    true,
  ).slice(s.hour);
  const problems: string[] = [];
  if (conflictCount(schedule.filter((m) => !m.deferred && m.start + m.duration > s.hour)))
    problems.push("Shared instrument-team windows overlap");
  if (
    schedule.some(
      (m) =>
        m.deferred &&
        m.priority !== "Flexible" &&
        executedHours(s, m.id) < baseMissions.find((b) => b.id === m.id)!.duration,
    )
  )
    problems.push("Priority work cannot fit its operating window");
  if (rows.some((r) => r.unserved > 0.01))
    problems.push("Adverse case exceeds available power or reserve");
  if (rows.some((r) => r.blockedMissions.length))
    problems.push("Field access conflicts with weather limits");
  if (Math.min(...rows.map((r) => r.fuel - r.fuelRate)) < STATION.protectedFuel)
    problems.push("Adverse fuel projection falls below protected buffer");
  return {
    feasible: !problems.length,
    problems,
    minimumFuel: Math.min(...rows.map((r) => r.fuel - r.fuelRate)),
    minimumBattery: Math.min(...rows.map((r) => r.battery)),
  };
}
export function resourceOutlook(s: PresentationState, kind: PlanKind) {
  const rows = stationTrajectory(s, kind, false, Math.max(s.hour, arrivalHour(s) - 1));
  const reference = rows.at(-1)!;
  const schedule = missionSchedule(kind, s);
  return {
    arrivalDay: arrivalHour(s) / 24,
    fuelAtResupply: round(reference.fuel - reference.fuelRate),
    minimumBattery: Math.min(...rows.slice(s.hour).map((r) => r.battery)),
    fuelUsed: round(currentStation(s).fuel - reference.fuel + reference.fuelRate),
    missions: schedule.filter((m) => !m.deferred).length,
    conflicts: conflictCount(schedule),
  };
}
export function forecastRows(s: PresentationState, horizon = 48) {
  return Array.from({ length: horizon + 1 }, (_, hour) => {
    const nominal = environmentalPoint(hour, s.inputs),
      adverse = environmentalPoint(hour, s.inputs, true),
      baseline = environmentalPoint(hour, BASE_INPUTS);
    return {
      hour,
      expected: nominal.renewable,
      baseline: baseline.renewable,
      range:
        hour >= s.hour
          ? [
              Math.min(nominal.renewable, adverse.renewable),
              Math.max(nominal.renewable, adverse.renewable),
            ]
          : null,
      demand: nominal.stationDemand,
      wind: nominal.wind,
      temperature: nominal.temperature,
      adverseDemand: adverse.stationDemand,
    };
  });
}
function record(
  s: PresentationState,
  type: string,
  title: string,
  detail: string,
  version = s.activeVersion,
): PresentationState {
  return {
    ...s,
    records: [
      ...s.records,
      {
        id: `record-${s.records.length + 1}`,
        hour: s.hour,
        type,
        title,
        detail,
        version,
        sync: s.uplink === "lost" ? "queued" : "local",
      },
    ],
  };
}
function refreshCurrent(s: PresentationState): PresentationState {
  const old = currentStation(s);
  return {
    ...s,
    observations: [
      ...s.observations.slice(0, s.hour),
      pointAt(s, s.hour, old.battery, old.fuel, s.activeSchedule, s.activeKind, true),
    ],
  };
}
export function presentationReducer(
  s: PresentationState,
  a: PresentationAction,
): PresentationState {
  if (a.type === "reset") return initialPresentation();
  if (a.type === "apply-outlook") {
    const inputs = a.inputs ?? RECORDING_INPUTS;
    if (
      s.proposal ||
      s.hour > 6 ||
      !validInputs(inputs) ||
      JSON.stringify(inputs) === JSON.stringify(s.inputs)
    )
      return s;
    return record(
      {
        ...s,
        inputs: { ...inputs },
        assumptionVersion: s.assumptionVersion + 1,
        outlookChanged: inputs.resupplyDelay > 0 || inputs.weatherSeverity > 0,
      },
      "forecast",
      "Future assumptions updated",
      `Resupply ${stationTime(STATION.resupplyHour)} → ${stationTime(STATION.resupplyHour + inputs.resupplyDelay * 24)}; weather event ${stationTime(inputs.weatherHour)}.`,
    );
  }
  if (a.type === "generate") {
    if (s.proposal || s.hour >= STATION.playbackEnd) return s;
    const kind = a.kind ?? activeCandidateKind(s),
      schedule = candidateSchedule(s, kind),
      assessment = planAssessment(s, schedule, kind);
    const trigger = s.derated
      ? "Generator 01 capacity loss"
      : s.outlookChanged
        ? "Weather and logistics exposure"
        : "Baseline joint-planning review";
    return record(
      {
        ...s,
        proposal: {
          version: s.activeVersion + 1,
          kind,
          status: "proposed",
          trigger,
          schedule,
          ...assessment,
          basis: s.assumptionVersion,
        },
      },
      "proposal",
      `Plan V${s.activeVersion + 1} proposed`,
      trigger,
      s.activeVersion + 1,
    );
  }
  if (["review", "approve", "activate", "reject"].includes(a.type)) {
    const p = s.proposal;
    if (!p) return s;
    if (a.type === "reject")
      return record(
        { ...s, proposal: null },
        "rejection",
        `Plan V${p.version} rejected`,
        "Previous schedule retained; operating conditions remain in force.",
        p.version,
      );
    if (a.type === "review" && p.status === "proposed")
      return record(
        { ...s, proposal: { ...p, status: "reviewed" } },
        "review",
        `Plan V${p.version} reviewed`,
        p.feasible
          ? "Operating limits inspected against adverse assumptions."
          : p.problems.join("; "),
        p.version,
      );
    if (a.type === "approve" && p.status === "reviewed" && p.feasible)
      return record(
        { ...s, proposal: { ...p, status: "approved" } },
        "approval",
        `Plan V${p.version} approved`,
        "Operator authorization recorded; activation remains a separate action.",
        p.version,
      );
    if (a.type === "activate" && p.status === "approved" && p.feasible) {
      const next = refreshCurrent({
        ...s,
        activeKind: p.kind,
        activeVersion: p.version,
        activeSchedule: p.schedule,
        proposal: null,
        activations: [
          ...s.activations,
          {
            hour: s.hour,
            kind: p.kind,
            version: p.version,
            schedule: p.schedule,
            inputs: { ...s.inputs },
          },
        ],
      });
      return record(
        next,
        "activation",
        `Plan V${p.version} activated`,
        "Current resource inventory and executed intervals retained.",
        p.version,
      );
    }
    return s;
  }
  if (a.type === "advance") {
    if (s.proposal || !Number.isInteger(a.hours) || a.hours <= 0) return s;
    const target = Math.min(STATION.playbackEnd, s.hour + a.hours);
    const stop =
      s.outlookChanged && !s.observedWeather && s.hour < s.inputs.weatherHour
        ? Math.min(target, s.inputs.weatherHour)
        : target;
    let next = s;
    while (next.hour < stop) {
      const h = next.hour + 1,
        inventory = nextInventory(currentStation(next), next);
      next = {
        ...next,
        hour: h,
        observations: [
          ...next.observations,
          pointAt(
            next,
            h,
            inventory.battery,
            inventory.fuel,
            next.activeSchedule,
            next.activeKind,
            true,
          ),
        ],
      };
    }
    return next;
  }
  if (a.type === "observe-weather") {
    const severity = a.severity ?? s.inputs.weatherSeverity;
    if (
      s.proposal ||
      s.observedWeather ||
      s.hour < s.inputs.weatherHour ||
      !Number.isFinite(severity) ||
      severity <= 0 ||
      severity > 1
    )
      return s;
    return record(
      refreshCurrent({ ...s, observedWeather: { hour: s.hour, severity } }),
      "weather",
      "Weather deterioration observed",
      "Local wind, solar availability, visibility and heating demand updated; historical observations retained.",
    );
  }
  if (a.type === "generator-event") {
    const capacity = a.capacity ?? 10;
    if (
      s.proposal ||
      s.generatorEvent ||
      s.hour < 26 ||
      !Number.isFinite(capacity) ||
      capacity < 0 ||
      capacity >= STATION.generatorOne
    )
      return s;
    const next = record(
      refreshCurrent({
        ...s,
        derated: true,
        generatorEvent: {
          hour: s.hour,
          capacity,
          reference: stationTrajectory(s, s.activeKind, false, 48),
        },
      }),
      "asset",
      `Generator 01 capacity reduced to ${capacity} kW`,
      `Available station diesel capacity ${capacity + STATION.generatorTwo} kW; inspect remaining work.`,
    );
    // Observation and response preparation are separate operator-visible stages.
    return next;
  }
  if (a.type === "uplink")
    return record(
      { ...s, uplink: s.uplink === "connected" ? "lost" : "connected", lastContactHour: s.hour },
      "connection",
      s.uplink === "connected" ? "External uplink unavailable" : "External uplink restored",
      "Local case execution and decision history retained; forecast refresh and acknowledgements are separate actions.",
    );
  if (a.type === "receive-forecast") {
    if (s.uplink !== "connected" || s.externalForecastHour === s.hour) return s;
    return record(
      { ...s, externalForecastHour: s.hour, lastContactHour: s.hour },
      "receipt",
      "External forecast receipt recorded",
      "Modeled provider receipt; operating assumptions remain under operator control.",
    );
  }
  if (a.type === "synchronize") {
    if (s.uplink !== "connected" || !s.records.some((r) => r.sync === "queued")) return s;
    return {
      ...s,
      lastAcknowledgedHour: s.hour,
      lastContactHour: s.hour,
      records: s.records.map((r) => (r.sync === "queued" ? { ...r, sync: "acknowledged" } : r)),
    };
  }
  return s;
}
export function missionProgress(s: PresentationState, m: Mission): string {
  const required = baseMissions.find((b) => b.id === m.id)!.duration,
    done = executedHours(s, m.id);
  if (done >= required) return "Completed";
  if (m.deferred) return "Deferred";
  if (currentStation(s).blockedMissions.includes(m.id)) return "Weather hold";
  if (currentStation(s).resourceHolds?.includes(m.id)) return "Resource hold";
  if (s.hour >= m.start + m.duration) return "Incomplete";
  return done > 0 || currentStation(s).runningMissions.includes(m.id) ? "In progress" : "Scheduled";
}
/** Forecast issued with each activated schedule; later observations cannot repaint that reference. */
export function monitoringReference(s: PresentationState): StationPoint[] {
  const references = new Map<number, StationPoint[]>();
  return s.observations.map((p) => {
    if (s.generatorEvent && p.hour >= s.generatorEvent.hour)
      return s.generatorEvent.reference[p.hour]!;
    const a = [...s.activations].reverse().find((x) => x.hour <= p.hour)!;
    if (!references.has(a.version)) {
      const atIssue = {
        ...s,
        hour: a.hour,
        inputs: a.inputs,
        activeSchedule: a.schedule,
        activeKind: a.kind,
        generatorEvent:
          s.generatorEvent && s.generatorEvent.hour <= a.hour ? s.generatorEvent : null,
        observations: s.observations.slice(0, a.hour + 1),
      };
      references.set(a.version, trajectoryForSchedule(atIssue, a.schedule, a.kind, s.hour));
    }
    return references.get(a.version)![p.hour]!;
  });
}
export function operationalAlerts(s: PresentationState) {
  const alerts: { title: string; detail: string; severity: "warning" | "good" }[] = [];
  const restrictedHour = Array.from(
    { length: Math.max(0, 49 - s.hour) },
    (_, i) => s.hour + i,
  ).find((h) => {
    const e = environmentalPoint(h, s.inputs);
    return e.visibility < 2 || e.wind > 55;
  });
  if (restrictedHour !== undefined)
    alerts.push({
      title: s.observedWeather ? "Weather restriction observed" : "Weather window narrowing",
      detail: s.observedWeather
        ? `Visibility ${currentStation(s).visibility} km · wind ${currentStation(s).wind.toFixed(0)} km/h`
        : `Restricted field conditions from ${stationTime(restrictedHour)}`,
      severity: "warning",
    });
  if (s.generatorEvent)
    alerts.push({
      title: "Generator 01 capacity reduced",
      detail: `${s.generatorEvent.capacity} / ${STATION.generatorOne} kW available`,
      severity: "warning",
    });
  if (s.inputs.resupplyDelay)
    alerts.push({
      title: `Resupply shifted by ${s.inputs.resupplyDelay} days`,
      detail: `Arrival ${stationTime(arrivalHour(s))}`,
      severity: "warning",
    });
  const conflicts = remainingConflictCount(s);
  if (conflicts)
    alerts.push({
      title: "Shared-resource conflicts",
      detail: `${conflicts} instrument-team overlaps · joint review required`,
      severity: "warning",
    });
  if (!alerts.length)
    alerts.push({
      title: "No outstanding condition notices",
      detail: "Inspect resource projections and configured limits separately",
      severity: "good",
    });
  return alerts;
}
export function remainingConflictCount(s: PresentationState) {
  return conflictCount(
    s.activeSchedule.filter((m) => !m.deferred && m.start + m.duration > s.hour),
  );
}
export function stationTime(hour: number) {
  return (
    new Date(Date.UTC(2026, 0, 15, 6) + hour * 3600000).toLocaleString("en-GB", {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " UTC"
  );
}
export function restorePresentation(value: unknown): PresentationState {
  const reset = () => initialPresentation();
  try {
    if (!value || typeof value !== "object") return reset();
    const s = value as PresentationState;
    const validSchedule = (items: Mission[]) =>
      Array.isArray(items) &&
      items.length === 6 &&
      new Set(items.map((m) => m.id)).size === 6 &&
      items.every(
        (m) =>
          baseMissions.some((b) => b.id === m.id) &&
          Number.isInteger(m.start) &&
          m.start >= 0 &&
          m.start < 48 &&
          Number.isInteger(m.duration) &&
          m.duration > 0 &&
          m.duration <= 4 &&
          Number.isFinite(m.power) &&
          m.power > 0 &&
          typeof m.name === "string" &&
          typeof m.short === "string" &&
          ["Essential", "High", "Flexible"].includes(m.priority) &&
          Number.isInteger(m.earliest) &&
          Number.isInteger(m.deadline) &&
          m.earliest >= 0 &&
          m.deadline <= 48 &&
          m.deadline > m.earliest &&
          typeof m.resource === "string",
      );
    if (
      s.schema !== 2 ||
      !Number.isInteger(s.hour) ||
      s.hour < 0 ||
      s.hour > STATION.playbackEnd ||
      !validInputs(s.inputs) ||
      !kinds.includes(s.activeKind) ||
      !Number.isInteger(s.activeVersion) ||
      s.activeVersion < 1 ||
      !Number.isInteger(s.assumptionVersion) ||
      s.assumptionVersion < 1 ||
      !validSchedule(s.activeSchedule) ||
      !["connected", "lost"].includes(s.uplink) ||
      typeof s.outlookChanged !== "boolean" ||
      typeof s.derated !== "boolean"
    )
      return reset();
    if (s.observedWeather !== null && (typeof s.observedWeather !== "object" || !s.observedWeather))
      return reset();
    if (s.generatorEvent !== null && (typeof s.generatorEvent !== "object" || !s.generatorEvent))
      return reset();
    if (s.derated !== !!s.generatorEvent) return reset();
    if (
      [s.externalForecastHour, s.lastContactHour, s.lastAcknowledgedHour ?? 0].some(
        (h) => !Number.isInteger(h) || h < 0 || h > s.hour,
      )
    )
      return reset();
    if (
      s.observedWeather &&
      (!Number.isInteger(s.observedWeather.hour) ||
        s.observedWeather.hour > s.hour ||
        s.observedWeather.hour < 18 ||
        !Number.isFinite(s.observedWeather.severity) ||
        s.observedWeather.severity <= 0 ||
        s.observedWeather.severity > 1)
    )
      return reset();
    if (
      s.generatorEvent &&
      (!Number.isInteger(s.generatorEvent.hour) ||
        s.generatorEvent.hour > s.hour ||
        s.generatorEvent.hour < 26 ||
        !Number.isFinite(s.generatorEvent.capacity) ||
        s.generatorEvent.capacity < 0 ||
        s.generatorEvent.capacity >= STATION.generatorOne ||
        !Array.isArray(s.generatorEvent.reference) ||
        s.generatorEvent.reference.length !== 49 ||
        s.generatorEvent.reference.some((p) => !Number.isFinite(p.g1)))
    )
      return reset();
    const numericKeys = [
      "demand",
      "renewable",
      "availableRenewable",
      "generator",
      "g1",
      "g2",
      "g1Capacity",
      "charge",
      "discharge",
      "battery",
      "fuel",
      "fuelRate",
      "unserved",
      "temperature",
      "wind",
      "visibility",
      "missionPower",
      "windPower",
      "solarPower",
      "curtailed",
    ] as const;
    if (
      !Array.isArray(s.observations) ||
      s.observations.length !== s.hour + 1 ||
      s.observations.some(
        (p, i) =>
          !p ||
          p.hour !== i ||
          numericKeys.some((k) => !Number.isFinite(p[k])) ||
          p.battery < 99.99 ||
          p.battery > 400.01 ||
          p.fuel < 0 ||
          !Array.isArray(p.runningMissions) ||
          !Array.isArray(p.blockedMissions) ||
          Math.abs(p.renewable + p.generator + p.discharge + p.unserved - p.demand - p.charge) >
            0.01,
      )
    )
      return reset();
    if (
      !Array.isArray(s.records) ||
      !s.records.length ||
      s.records.length > 500 ||
      new Set(s.records.map((r) => r.id)).size !== s.records.length ||
      s.records.some(
        (r) =>
          !r ||
          typeof r.id !== "string" ||
          typeof r.title !== "string" ||
          typeof r.detail !== "string" ||
          !Number.isInteger(r.hour) ||
          r.hour < 0 ||
          r.hour > s.hour ||
          !Number.isInteger(r.version) ||
          r.version < 1 ||
          r.version > s.activeVersion + 1 ||
          !["local", "queued", "acknowledged"].includes(r.sync),
      )
    )
      return reset();
    if (
      !Array.isArray(s.activations) ||
      !s.activations.length ||
      s.activations.length > 100 ||
      s.activations.some(
        (a, i) =>
          !validSchedule(a.schedule) ||
          !validInputs(a.inputs) ||
          !kinds.includes(a.kind) ||
          !Number.isInteger(a.hour) ||
          a.hour < 0 ||
          a.hour > s.hour ||
          a.version < 1 ||
          (i > 0 &&
            (a.hour < s.activations[i - 1]!.hour || a.version <= s.activations[i - 1]!.version)),
      )
    )
      return reset();
    const last = s.activations.at(-1)!;
    if (last.kind !== s.activeKind || last.version !== s.activeVersion) return reset();
    if (s.proposal !== null && (typeof s.proposal !== "object" || !s.proposal)) return reset();
    if (
      s.proposal &&
      (!validSchedule(s.proposal.schedule) ||
        !kinds.includes(s.proposal.kind) ||
        !["proposed", "reviewed", "approved"].includes(s.proposal.status) ||
        s.proposal.version !== s.activeVersion + 1 ||
        s.proposal.basis !== s.assumptionVersion ||
        typeof s.proposal.feasible !== "boolean" ||
        !Number.isFinite(s.proposal.minimumBattery) ||
        !Number.isFinite(s.proposal.minimumFuel) ||
        !Array.isArray(s.proposal.problems))
    )
      return reset();
    return s;
  } catch {
    return reset();
  }
}
