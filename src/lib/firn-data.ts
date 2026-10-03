export type ScenarioId = "normal" | "storm" | "generator" | "fuel" | "battery";
export type Scenario = {
  id: ScenarioId;
  label: string;
  temperature: string;
  wind: string;
  visibility: string;
  risk: string;
  solar: number;
  windPower: number;
  battery: number;
  fuel: string;
  headline: string;
  message: string;
  impact: string;
  actions: string[];
};

export const scenarios: Record<ScenarioId, Scenario> = {
  normal: {
    id: "normal",
    label: "Normal Conditions",
    temperature: "-28°C",
    wind: "42 km/h",
    visibility: "4.2 km",
    risk: "MODERATE",
    solar: 22,
    windPower: 46,
    battery: 74,
    fuel: "1,240 L",
    headline: "NORMAL OPERATING CONDITIONS",
    message:
      "FIRN is continuously evaluating station energy, mission requirements, asset availability and forecast conditions.",
    impact: "Current plan is stable",
    actions: [
      "Maintain the current mission schedule",
      "Prioritize renewable generation",
      "Preserve battery reserve above 30%",
    ],
  },
  storm: {
    id: "storm",
    label: "Severe Storm",
    temperature: "-31°C",
    wind: "68 km/h",
    visibility: "1.8 km",
    risk: "HIGH",
    solar: 8,
    windPower: 18,
    battery: 61,
    fuel: "1,240 L",
    headline: "PLAN UPDATED",
    message:
      "FIRN detected a projected renewable shortfall and automatically generated a revised operating plan.",
    impact: "Adaptive replanning required",
    actions: [
      "Move Experiment A earlier to 09:00",
      "Defer Experiment B by 6 hours",
      "Run Sample Processing; protect Water Production",
      "Protect battery reserve; keep Generator 01 ready",
      "Conserve fuel for critical backup",
    ],
  },
  generator: {
    id: "generator",
    label: "Generator Failure",
    temperature: "-28°C",
    wind: "42 km/h",
    visibility: "4.2 km",
    risk: "MODERATE",
    solar: 22,
    windPower: 46,
    battery: 74,
    fuel: "1,240 L",
    headline: "ASSET FAILURE DETECTED",
    message:
      "Generator 02 is unavailable. FIRN has reprioritized missions around remaining assets and protected critical station loads.",
    impact: "Asset-Aware replanning active",
    actions: [
      "Preserve battery reserve",
      "Prioritize heating, water and communications",
      "Defer Experiment B; reschedule Atmospheric Observation",
      "Increase renewable utilization",
      "Keep Generator 01 available for backup",
    ],
  },
  fuel: {
    id: "fuel",
    label: "Fuel Resupply Delay",
    temperature: "-28°C",
    wind: "42 km/h",
    visibility: "4.2 km",
    risk: "MODERATE",
    solar: 22,
    windPower: 46,
    battery: 74,
    fuel: "1,240 L",
    headline: "FUEL CONSERVATION STRATEGY ACTIVATED",
    message:
      "Resupply delayed by 5 days. A fuel runway constraint has been detected and the operating plan has been adapted.",
    impact: "Fuel-Aware Planning active",
    actions: [
      "Reduce non-essential generator operation",
      "Prefer renewable energy",
      "Preserve fuel for critical backup",
      "Reschedule flexible missions",
    ],
  },
  battery: {
    id: "battery",
    label: "Low Battery Capacity",
    temperature: "-33°C",
    wind: "42 km/h",
    visibility: "4.2 km",
    risk: "MODERATE",
    solar: 22,
    windPower: 46,
    battery: 61,
    fuel: "1,240 L",
    headline: "BATTERY CAPACITY CONSTRAINT",
    message:
      "Extreme cold conditions reduced usable battery capacity by 30%. FIRN has adapted energy allocation to protect critical loads.",
    impact: "Reserve protection increased",
    actions: [
      "Increase reserve protection",
      "Reduce battery-dependent flexible missions",
      "Shift energy-intensive missions toward renewable availability",
      "Keep critical loads protected",
    ],
  },
};

export const missionData = [
  {
    name: "Experiment A",
    power: "8 kW",
    duration: "4 hrs",
    priority: "HIGH",
    status: "RUNNING",
    deadline: "Today, 18:00",
    weather: "Low",
    equipment: "Spectrometer",
    interruptible: "No",
    recommendation: "Run during high renewable availability",
  },
  {
    name: "Experiment B",
    power: "10 kW",
    duration: "3 hrs",
    priority: "MEDIUM",
    status: "SCHEDULED",
    deadline: "Tomorrow, 18:00",
    weather: "Medium",
    equipment: "Imaging System",
    interruptible: "Yes",
    recommendation: "Flexible",
  },
  {
    name: "Sample Processing",
    power: "5 kW",
    duration: "2 hrs",
    priority: "HIGH",
    status: "SCHEDULED",
    deadline: "Today, 22:00",
    weather: "Low",
    equipment: "Lab instruments",
    interruptible: "Yes",
    recommendation: "Schedule during afternoon renewable peak",
  },
  {
    name: "Water Production",
    power: "12 kW",
    duration: "2 hrs",
    priority: "CRITICAL",
    status: "PROTECTED",
    deadline: "Continuous",
    weather: "None",
    equipment: "Desalination unit",
    interruptible: "No",
    recommendation: "Protected load",
  },
  {
    name: "Atmospheric Observation",
    power: "6 kW",
    duration: "3 hrs",
    priority: "MEDIUM",
    status: "SCHEDULED",
    deadline: "Tomorrow, 12:00",
    weather: "High",
    equipment: "Atmospheric sensors",
    interruptible: "Yes",
    recommendation: "Schedule outside storm window",
  },
];

export const assetData = [
  {
    name: "Solar Array",
    type: "SOLAR",
    capacity: "30 kW installed",
    available: "22 kW expected",
    condition: "96%",
    constraint: "Daylight and cloud cover",
    status: "Available",
  },
  {
    name: "Wind Turbine",
    type: "WIND",
    capacity: "50 kW installed",
    available: "46 kW expected",
    condition: "91%",
    constraint: "Storm cut-out threshold",
    status: "Available",
  },
  {
    name: "Battery",
    type: "STORAGE",
    capacity: "218 kWh usable",
    available: "74% SOC",
    condition: "-25°C",
    constraint: "30% minimum reserve",
    status: "Available",
  },
  {
    name: "Diesel Generator 01",
    type: "BACKUP",
    capacity: "100 kW capacity",
    available: "Standby",
    condition: "88%",
    constraint: "High fuel dependency",
    status: "Available",
  },
  {
    name: "Diesel Generator 02",
    type: "BACKUP",
    capacity: "100 kW capacity",
    available: "Estimated return: 18 hours",
    condition: "Maintenance",
    constraint: "Scheduled maintenance",
    status: "Maintenance",
  },
];

export const forecastData = [
  { time: "00:00", renewable: 42, demand: 49, battery: 78 },
  { time: "02:00", renewable: 44, demand: 48, battery: 77 },
  { time: "04:00", renewable: 48, demand: 47, battery: 76 },
  { time: "06:00", renewable: 55, demand: 51, battery: 75 },
  { time: "08:00", renewable: 68, demand: 52, battery: 74 },
  { time: "10:00", renewable: 72, demand: 56, battery: 78 },
  { time: "12:00", renewable: 75, demand: 59, battery: 82 },
  { time: "14:00", renewable: 63, demand: 61, battery: 81 },
  { time: "16:00", renewable: 45, demand: 58, battery: 75 },
  { time: "18:00", renewable: 30, demand: 54, battery: 66 },
  { time: "20:00", renewable: 26, demand: 51, battery: 57 },
  { time: "22:00", renewable: 35, demand: 48, battery: 53 },
  { time: "24:00", renewable: 43, demand: 49, battery: 51 },
];

export const normalLog = [
  {
    time: "07:40",
    event: "Station assessment completed",
    action: "Current plan confirmed",
    reason: "Available renewables support scheduled missions and critical loads.",
  },
  {
    time: "07:32",
    event: "Asset availability checked",
    action: "Generator 02 excluded",
    reason: "Scheduled maintenance; Generator 01 retained as backup.",
  },
  {
    time: "07:15",
    event: "Forecast analyzed",
    action: "Battery reserve maintained",
    reason: "Weather Risk increases over the next 8 hours.",
  },
];

export const stormLog = [
  {
    time: "08:08",
    event: "Battery reserve protected",
    action: "Critical operations maintained",
    reason: "Heating, water and communications take priority over flexible missions.",
  },
  {
    time: "08:08",
    event: "Experiment B deferred",
    action: "6-hour delay",
    reason: "Medium-priority mission can wait until renewable availability improves.",
  },
  {
    time: "08:07",
    event: "Battery reserve risk detected",
    action: "Adaptive Replanning triggered",
    reason: "Projected renewable shortfall threatens minimum reserve.",
  },
  {
    time: "08:05",
    event: "Renewable generation forecast reduced",
    action: "Risk assessment updated",
    reason: "Solar and wind output expected to fall during storm window.",
  },
  {
    time: "08:00",
    event: "Forecast update received",
    action: "Storm risk increased",
    reason: "Wind increased and visibility fell to 1.8 km.",
  },
];
