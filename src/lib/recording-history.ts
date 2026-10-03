/** Pre-case modeled operation, not measurements from hardware or forecast training data. */
import {
  BASE_INPUTS,
  STATION,
  environmentalPoint,
  fuelConsumption,
  stationTrajectory,
  type PresentationState,
  type StationPoint,
} from "./recording-engine.ts";

export const HISTORY_HOURS = 48;
const round = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Routine daily battery-buffer policy, with no upcoming mission work or storm input.
 * Dispatch follows the target; inventories are integrated from the resulting flows.
 * Fuel opening is sized from consumption to retain the agreed H0 inventory.
 */
export function preCaseHistory(): StationPoint[] {
  const rows: StationPoint[] = [];
  let battery = STATION.initialBattery;
  for (let hour = -HISTORY_HOURS; hour < 0; hour++) {
    const e = environmentalPoint(hour, BASE_INPUTS);
    const target = STATION.initialBattery + 36 * Math.sin(((hour + 1) * Math.PI) / 12);
    const charge = round(Math.max(0, (target - battery) / 0.94));
    const discharge = round(Math.max(0, (battery - target) * 0.94));
    const diesel = Math.max(0, e.stationDemand + charge - discharge - e.renewable);
    const g1 = round(Math.min(STATION.generatorOne, diesel));
    const g2 = round(Math.min(STATION.generatorTwo, Math.max(0, diesel - g1)));
    const renewable = round(Math.min(e.renewable, e.stationDemand + charge - discharge - g1 - g2));
    rows.push({
      hour,
      demand: e.stationDemand,
      renewable,
      availableRenewable: e.renewable,
      generator: round(g1 + g2),
      g1,
      g2,
      g1Capacity: STATION.generatorOne,
      charge,
      discharge,
      battery: round(battery),
      fuel: 0,
      fuelRate: round(fuelConsumption(g1, g2)),
      criticalServed: true,
      unserved: 0,
      temperature: e.temperature,
      wind: e.wind,
      visibility: e.visibility,
      missionPower: 0,
      windPower: e.windPower,
      solarPower: e.solarPower,
      runningMissions: [],
      blockedMissions: [],
      resourceHolds: [],
      curtailed: round(e.renewable - renewable),
    });
    battery += charge * 0.94 - discharge / 0.94;
  }
  if (Math.abs(battery - STATION.initialBattery) > 0.002)
    throw new Error("Historical dispatch does not close at the case battery inventory");
  let fuel = STATION.initialFuel + rows.reduce((sum, p) => sum + p.fuelRate, 0);
  for (const p of rows) {
    p.fuel = round(fuel);
    fuel -= p.fuelRate;
  }
  return rows;
}

/** Preserve indexed case observations; never insert negative hours into execution state. */
export function observedHistory(s: PresentationState): StationPoint[] {
  return [...preCaseHistory(), ...stationTrajectory(s, s.activeKind, true, s.hour)].map((p) => ({
    ...p,
    runningMissions: [...p.runningMissions],
    blockedMissions: [...p.blockedMissions],
    ...(p.resourceHolds ? { resourceHolds: [...p.resourceHolds] } : {}),
  }));
}
