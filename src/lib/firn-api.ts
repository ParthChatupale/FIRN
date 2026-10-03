import { requestApi } from "./api-transport";
export { FirnApiError } from "./api-transport";
export type PlanningMode = "saved" | "nominal" | "adverse" | "robust";
export type CaseOutlook = {
  source_run_id: string;
  config_fingerprint: string;
  origin_hour: number;
  horizon_hours: number;
  forecast: {
    method: string;
    training_hours: number;
    points: Array<{ hour: number; demand_kw: number; renewable_kw: number }>;
  };
  cases: Array<{
    name: string;
    description: string;
    summary: SimulationSummary & Record<string, number | boolean | null>;
    telemetry: TelemetryPoint[];
    mission_results: Array<Record<string, unknown>>;
  }>;
  assumptions: Record<string, unknown>;
};
export type ApiScenario =
  | "normal"
  | "storm"
  | "generator_failure"
  | "resupply_delay"
  | "low_renewable"
  | "mission_energy"
  | "battery_capacity_loss";

export type SimulationSummary = {
  duration_hours: number;
  battery_min_kwh: number;
  battery_final_kwh: number;
  fuel_remaining_liters: number;
  missions_completed: number;
  missions_failed: number;
  critical_violation_hours: number;
  renewable_share_percent: number;
  unserved_energy_kwh: number;
};

export type SimulationRun = {
  id: string;
  scenario: ApiScenario;
  station_name: string;
  duration_days: number;
  seed: number;
  simulator_version: string;
  started_at: string;
  created_at: string;
  config_snapshot: { station: StationProfile["configuration"]; start_time?: string } & Record<
    string,
    unknown
  >;
  summary: SimulationSummary;
  mission_results: Array<Record<string, unknown>>;
};

export type TelemetryPoint = {
  hour: number;
  timestamp: string;
  battery_kwh: number;
  battery_soc_percent: number;
  renewable_kw: number;
  solar_kw?: number;
  wind_kw?: number;
  generator_output_kw?: Record<string, number>;
  demand_kw: number;
  fuel_liters: number;
  served_kw?: number;
  weather_regime?: string;
  temperature_c?: number;
  wind_kmh?: number;
  visibility_km?: number;
  fuel_runway_hours?: number | null;
  resupply_arrival_hour?: number | null;
  critical_violation?: boolean;
  generator_status?: Record<string, string>;
  battery_charge_kw?: number;
  battery_discharge_kw?: number;
  curtailed_kw?: number;
  critical_served_kw?: number;
  critical_requested_kw?: number;
};

type TelemetryPage = { items: TelemetryPoint[]; limit: number; offset: number; total: number };
export type ApiHealth = { status: string; database: string };
export type StationProfile = {
  name: string;
  profile: string;
  configuration: {
    solar_capacity_kw: number;
    wind_capacity_kw: number;
    initial_fuel_liters: number;
    fuel_capacity_liters: number;
    battery: {
      capacity_kwh: number;
      initial_kwh: number;
      reserve_kwh: number;
      max_charge_kw: number;
      max_discharge_kw: number;
    };
    generators: Array<{
      id: string;
      name: string;
      capacity_kw: number;
      minimum_kw: number;
      initially_available: boolean;
      liters_per_kwh: number;
    }>;
    missions: Array<{
      id: string;
      name: string;
      power_kw: number;
      duration_hours: number;
      priority: number;
      start_hour: number;
      equipment?: string[];
      personnel?: string[];
      minimum_visibility_km?: number;
      maximum_wind_kmh?: number;
    }>;
    fuel_resupply?: { arrival_hour: number; fuel_liters: number } | null;
  };
};

export type PlanScheduleItem = {
  mission_id: string;
  selected: boolean;
  start_hour?: number | null;
  duration_hours?: number;
  reason?: string;
  [key: string]: unknown;
};

export type PlanDispatchPoint = {
  hour: number;
  renewable_available_kw?: number;
  renewable_used_kw?: number;
  battery_charge_kw?: number;
  battery_discharge_kw?: number;
  demand_kw?: number;
  battery_soc_kwh?: number;
  fuel_liters?: number;
  generator_output_kw?: Record<string, number>;
  [key: string]: unknown;
};

export type PlanVersion = {
  id: string;
  plan_group_id: string;
  version_number: number;
  parent_version_id: string | null;
  simulation_start_time: string;
  source_simulation_run_id: string | null;
  station_name: string;
  scenario: ApiScenario;
  days: number;
  seed: number;
  status: "proposed" | "reviewed" | "approved" | "active" | "superseded" | "rejected";
  solver_name: string;
  solver_version: string;
  planner_model_version: string;
  plan_snapshot: {
    status?: string;
    objective?: Record<string, number | string | null>;
    schedule?: PlanScheduleItem[];
    dispatch?: PlanDispatchPoint[];
    [key: string]: unknown;
  };
  explanations: {
    mission_decisions?: Array<Record<string, unknown>>;
    binding_constraint_evidence?: Array<{
      constraint: string;
      evidence_hours: number[];
      explanation: string;
    }>;
    replay_impact?: Record<string, number | null>;
    interpretation_limit?: string;
    [key: string]: unknown;
  };
  created_at: string;
  history: Array<{
    action: string;
    from_status?: string | null;
    to_status?: string | null;
    actor?: string;
    note?: string | null;
    created_at?: string;
  }>;
};

export type PlanComparison = {
  plan_group_id: string;
  baseline_version: number;
  candidate_version: number;
  mission_changes: Array<{
    mission_id: string;
    before: { selected?: boolean; start_hour?: number | null };
    after: { selected?: boolean; start_hour?: number | null };
  }>;
  objective_delta: Record<string, number | null>;
  replay_delta: Record<string, number | null>;
};

export type MonitoringEvent = {
  id: string;
  hour: number;
  rule: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  action: string;
  observation: Record<string, unknown>;
  proposal_plan_version_id: string | null;
  created_at: string;
};

export type MonitoringSession = {
  id: string;
  station_name: string;
  plan_version_id: string;
  simulation_run_id: string;
  current_hour: number;
  status: string;
  last_proposal_hour: number | null;
  pending_proposal_id: string | null;
  plan_origin_hour?: number;
  execution_policy?: string;
  trajectory?: TelemetryPoint[];
  active_alerts?: Array<{
    rule: string;
    severity: string;
    first_seen_hour?: number;
    last_seen_hour?: number;
  }>;
  observed_events?: Array<Record<string, unknown>>;
  latest_observation: {
    hour?: number;
    timestamp?: string;
    renewable_kw?: number;
    demand_kw?: number;
    served_kw?: number;
    battery_kwh?: number;
    fuel_liters?: number;
    fuel_runway_hours?: number | null;
    critical_violation?: boolean;
    weather?: Record<string, unknown>;
    generator_status?: Record<string, string>;
    mission_events?: Array<Record<string, unknown>>;
    forecast_comparison?: Record<string, number | null>;
    mission_progress?: Array<Record<string, unknown>>;
    simulation_events?: Array<Record<string, unknown>>;
  } | null;
  events: MonitoringEvent[];
  created_at: string;
  updated_at: string;
};

const API_BASE = (import.meta.env["VITE_FIRN_API_URL"] || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);

export function getApiHealth(): Promise<ApiHealth> {
  return requestJson<ApiHealth>("/api/health");
}

export function getStationProfile(): Promise<StationProfile> {
  return requestJson<StationProfile>("/api/station");
}

async function requestJson<T>(path: string, init?: RequestInit, timeoutMs = 15000): Promise<T> {
  return requestApi<T>(`${API_BASE}${path}`, init, timeoutMs);
}

export function getCaseOutlook(
  runId: string,
  origin = 0,
  sessionId?: string,
): Promise<CaseOutlook> {
  return requestJson(
    `/api/simulation-runs/${encodeURIComponent(runId)}/outlook?origin_hour=${origin}&horizon_hours=24${sessionId ? `&monitoring_session_id=${encodeURIComponent(sessionId)}` : ""}`,
    undefined,
    60000,
  );
}

export function createSimulationRun(input: {
  scenario: ApiScenario;
  days: number;
  seed: number;
}): Promise<SimulationRun> {
  return requestJson<SimulationRun>("/api/simulation-runs", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getSimulationRun(runId: string): Promise<SimulationRun> {
  return requestJson<SimulationRun>(`/api/simulation-runs/${encodeURIComponent(runId)}`);
}

export async function getSimulationTelemetry(runId: string, limit = 500): Promise<TelemetryPage> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
    throw new Error("Invalid telemetry page size.");
  const items: TelemetryPoint[] = [];
  let total = Number.POSITIVE_INFINITY;
  while (items.length < total) {
    const page = await requestJson<TelemetryPage>(
      `/api/simulation-runs/${encodeURIComponent(runId)}/telemetry?limit=${limit}&offset=${items.length}`,
    );
    items.push(...page.items);
    total = page.total;
    if (page.items.length === 0 && items.length < total)
      throw new Error("The saved telemetry is incomplete. Retry loading this run.");
  }
  return { items, limit, offset: 0, total: items.length };
}

export function listSimulationRuns(
  limit = 20,
): Promise<{ items: SimulationRun[]; limit: number; offset: number }> {
  return requestJson(`/api/simulation-runs?limit=${limit}&offset=0`);
}

export function getSimulationEvents(runId: string): Promise<Array<Record<string, unknown>>> {
  return requestJson(`/api/simulation-runs/${encodeURIComponent(runId)}/events`);
}

export function createPlanProposal(input: {
  source_simulation_run_id: string;
  flexibility_hours?: number;
  planning_mode?: PlanningMode;
  request_id?: string;
}): Promise<PlanVersion> {
  return requestJson(
    "/api/plan-proposals",
    { method: "POST", body: JSON.stringify(input) },
    120000,
  );
}

export function getPlan(planId: string): Promise<PlanVersion> {
  return requestJson(`/api/plans/${encodeURIComponent(planId)}`);
}

export function listPlans(
  status?: PlanVersion["status"],
): Promise<{ items: PlanVersion[]; limit: number; offset: number }> {
  const query = status ? `?status=${encodeURIComponent(status)}&limit=50` : "?limit=50";
  return requestJson(`/api/plans${query}`);
}

export function actOnPlan(
  planId: string,
  action: "review" | "approve" | "reject" | "activate",
  note?: string,
  actor = "operator",
): Promise<PlanVersion> {
  return requestJson(`/api/plans/${encodeURIComponent(planId)}/actions`, {
    method: "POST",
    body: JSON.stringify({ action, actor, note }),
  });
}

export function editPlan(
  planId: string,
  missionStartHours: Record<string, number>,
  actor = "operator",
  requestId?: string,
): Promise<PlanVersion> {
  return requestJson(
    `/api/plans/${encodeURIComponent(planId)}/edits?actor=${encodeURIComponent(actor)}`,
    {
      method: "POST",
      body: JSON.stringify({ mission_start_hours: missionStartHours, request_id: requestId }),
    },
    120000,
  );
}

export function getPlanVersions(
  groupId: string,
): Promise<{ items: PlanVersion[]; limit: number; offset: number }> {
  return requestJson(`/api/plan-groups/${encodeURIComponent(groupId)}/versions?limit=100`);
}

export function comparePlanVersions(
  groupId: string,
  baseline: number,
  candidate: number,
): Promise<PlanComparison> {
  return requestJson(
    `/api/plan-groups/${encodeURIComponent(groupId)}/compare?baseline_version=${baseline}&candidate_version=${candidate}`,
  );
}

export function createMonitoringSession(
  planVersionId: string,
  simulationRunId: string,
): Promise<MonitoringSession> {
  return requestJson("/api/monitoring-sessions", {
    method: "POST",
    body: JSON.stringify({ plan_version_id: planVersionId, simulation_run_id: simulationRunId }),
  });
}

export function getMonitoringSession(sessionId: string): Promise<MonitoringSession> {
  return requestJson(`/api/monitoring-sessions/${encodeURIComponent(sessionId)}`);
}

export function advanceMonitoring(
  sessionId: string,
  hours: number,
  expectedHour?: number,
): Promise<MonitoringSession> {
  return requestJson(
    `/api/monitoring-sessions/${encodeURIComponent(sessionId)}/advance`,
    {
      method: "POST",
      body: JSON.stringify({ hours, expected_hour: expectedHour }),
    },
    120000,
  );
}
