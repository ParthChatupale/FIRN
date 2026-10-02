export type ApiScenario =
  | "normal"
  | "storm"
  | "generator_failure"
  | "resupply_delay"
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
  config_snapshot: { station: { battery: { capacity_kwh: number } } } & Record<string, unknown>;
  summary: SimulationSummary;
  mission_results: Array<Record<string, unknown>>;
};

export type TelemetryPoint = {
  hour: number;
  timestamp: string;
  battery_kwh: number;
  battery_soc_percent: number;
  renewable_kw: number;
  demand_kw: number;
  fuel_liters: number;
};

type TelemetryPage = { items: TelemetryPoint[]; limit: number; offset: number; total: number };
export type ApiHealth = { status: string; database: string };

const API_BASE = (import.meta.env.VITE_FIRN_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export function getApiHealth(): Promise<ApiHealth> {
  return requestJson<ApiHealth>("/api/health");
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new Error("FIRN API is unreachable. Start the local FastAPI service and retry.");
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) detail = payload.detail;
    } catch {
      // Keep the status-based message if the response isn't JSON.
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
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

export function getSimulationTelemetry(runId: string, limit = 24): Promise<TelemetryPage> {
  return requestJson<TelemetryPage>(
    `/api/simulation-runs/${encodeURIComponent(runId)}/telemetry?limit=${limit}&offset=0`,
  );
}
