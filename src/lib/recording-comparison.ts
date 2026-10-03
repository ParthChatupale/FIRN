/** Read-only comparison reports; calculating one never proposes or activates a plan. */
import {
  currentStation,
  resourceOutlook,
  STATION,
  type PlanKind,
  type PresentationState,
} from "./recording-engine.ts";

export type ComparisonReport = {
  source: "baseline" | "generated" | "assessment";
  hour: number;
  minute: number;
  basis: number;
  activeVersion: number;
  generatorCapacity: number;
  weatherObserved: boolean;
  leadMinutes: number;
  entries: {
    approach: "original" | "energy" | "joint";
    kind: PlanKind;
    outlook: ReturnType<typeof resourceOutlook>;
  }[];
};

export function buildComparisonReport(
  state: PresentationState,
  source: ComparisonReport["source"],
): ComparisonReport {
  const jointKind =
    state.proposal?.kind ??
    (state.generatorEvent ? "adaptive" : state.outlookChanged ? "weather" : "joint");
  return {
    source,
    hour: state.hour,
    minute: state.minute ?? 0,
    basis: state.assumptionVersion,
    activeVersion: state.activeVersion,
    generatorCapacity: currentStation(state).g1Capacity,
    weatherObserved: !!state.observedWeather,
    leadMinutes: state.planningLeadMinutes ?? 30,
    entries: (["original", "energy", "joint"] as const).map((approach) => {
      const kind = approach === "joint" ? jointKind : approach;
      return { approach, kind, outlook: resourceOutlook(state, kind) };
    }),
  };
}

export function comparisonMatchesState(report: ComparisonReport, state: PresentationState) {
  return (
    report.hour === state.hour &&
    report.minute === (state.minute ?? 0) &&
    report.basis === state.assumptionVersion &&
    report.activeVersion === state.activeVersion &&
    report.generatorCapacity === currentStation(state).g1Capacity &&
    report.weatherObserved === !!state.observedWeather &&
    report.leadMinutes === (state.planningLeadMinutes ?? 30)
  );
}

/** Invalid optional report data is discarded, never used to reset a valid station case. */
export function validComparisonReport(
  raw: unknown,
  state: PresentationState,
): raw is ComparisonReport {
  if (!raw || typeof raw !== "object") return false;
  const report = raw as ComparisonReport;
  return (
    ["baseline", "generated", "assessment"].includes(report.source) &&
    Number.isInteger(report.hour) &&
    report.hour >= 0 &&
    report.hour <= state.hour &&
    Number.isInteger(report.minute) &&
    report.minute >= 0 &&
    report.minute < 60 &&
    (report.hour < state.hour || report.minute <= (state.minute ?? 0)) &&
    Number.isInteger(report.basis) &&
    report.basis >= 1 &&
    report.basis <= state.assumptionVersion &&
    Number.isInteger(report.activeVersion) &&
    report.activeVersion >= 1 &&
    report.activeVersion <= state.activeVersion &&
    Number.isFinite(report.generatorCapacity) &&
    report.generatorCapacity >= 0 &&
    report.generatorCapacity <= STATION.generatorOne &&
    typeof report.weatherObserved === "boolean" &&
    Number.isFinite(report.leadMinutes) &&
    report.leadMinutes >= 0 &&
    Array.isArray(report.entries) &&
    report.entries.length === 3 &&
    report.entries.every((entry, index) => {
      if (
        !entry ||
        entry.approach !== ["original", "energy", "joint"][index] ||
        !["original", "energy", "joint", "weather", "adaptive"].includes(entry.kind) ||
        (index < 2 && entry.kind !== entry.approach) ||
        !entry.outlook
      )
        return false;
      const o = entry.outlook;
      return (
        [o.arrivalDay, o.fuelAtResupply, o.minimumBattery, o.fuelUsed].every(Number.isFinite) &&
        Number.isInteger(o.missions) &&
        o.missions >= 0 &&
        o.missions <= 6 &&
        Number.isInteger(o.conflicts) &&
        o.conflicts >= 0
      );
    })
  );
}
