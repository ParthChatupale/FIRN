/** Operator workflow around the pure station case. Timing is UI pacing, not solver benchmarking. */
import {
  initialPresentation,
  presentationReducer,
  restorePresentation,
  currentStation,
  environmentalPoint,
  planAssessment,
  remainingConflictCount,
  stationTime,
  STATION,
  validInputs,
  type ScenarioInputs,
  type PresentationState,
  type PresentationAction,
} from "./recording-engine.ts";

export const WORKFLOW_KEY = "firn:presentation:v3";
export const PREPARATION_MS = { plan: 2500, forecast: 1000, assessment: 1200 } as const;
export type PreparationKind = keyof typeof PREPARATION_MS;
export type Attention = {
  id: string;
  key: string;
  title: string;
  detail: string;
  priority: "advisory" | "caution" | "warning" | "critical";
  scope: "planning" | "forecast" | "monitoring" | "connection";
  hour: number;
  receivedAt: string | null;
  sequence: number;
  basis: number;
  planVersion: number;
  active: boolean;
  acknowledged: boolean;
  condition: boolean;
  route: "/mission-planner" | "/forecast" | "/monitoring" | "/";
  action: string;
  durationMs?: number;
};
export type WorkflowState = PresentationState & {
  workflow: 1;
  failedPreparation: PreparationKind | null;
  sequence: number;
  preparation: { token: number; kind: PreparationKind; basis: number; hour: number } | null;
  forecastReadyBasis: number;
  comparisonReady: boolean;
  readyInputs: ScenarioInputs;
  responseRequired: boolean;
  attention: Attention[];
};
export type WorkflowAction = (
  | PresentationAction
  | { type: "complete-task"; token: number; elapsedMs: number }
  | { type: "fail-task"; token: number }
  | { type: "ack-attention"; id: string }
  | { type: "retry-task" }
) & { receivedAt?: string };

type Notice = Pick<
  Attention,
  "key" | "title" | "detail" | "priority" | "scope" | "route" | "action"
>;
function notice(
  s: WorkflowState,
  n: Notice,
  a: WorkflowAction,
  condition = false,
  durationMs?: number,
): WorkflowState {
  const sequence = s.sequence + 1;
  return {
    ...s,
    sequence,
    attention: [
      ...s.attention,
      {
        ...n,
        id: `attention-${sequence}`,
        sequence,
        hour: s.hour,
        receivedAt: a.receivedAt ?? null,
        basis: s.assumptionVersion,
        planVersion:
          s.proposal && n.key.startsWith("proposal-") ? s.proposal.version : s.activeVersion,
        active: true,
        acknowledged: false,
        condition,
        ...(durationMs === undefined ? {} : { durationMs }),
      },
    ],
  };
}
function conditions(s: WorkflowState): Notice[] {
  const result: Notice[] = [];
  const c = currentStation(s),
    conflicts = remainingConflictCount(s);
  if (conflicts)
    result.push({
      key: `conflicts-v${s.activeVersion}`,
      title: "Upcoming shared-resource conflicts",
      detail: `${conflicts} instrument-team overlaps in remaining work`,
      priority: "caution",
      scope: "planning",
      route: "/mission-planner",
      action: "Inspect active schedule",
    });
  if (s.generatorEvent)
    result.push({
      key: "limited-generator-capacity",
      title: "Generator capacity remains limited",
      detail: `${s.generatorEvent.capacity} / ${STATION.generatorOne} kW available on Generator 01; active V${s.activeVersion}`,
      priority: "advisory",
      scope: "monitoring",
      route: "/monitoring",
      action: "Inspect equipment impact",
    });
  if (!c.criticalServed || c.unserved > 0.01)
    result.push({
      key: "unserved",
      title: c.criticalServed ? "Demand shortfall observed" : "Essential service shortfall",
      detail: `${c.unserved.toFixed(1)} kW unserved at H${s.hour}`,
      priority: c.criticalServed ? "warning" : "critical",
      scope: "monitoring",
      route: "/monitoring",
      action: "Inspect supply impact",
    });
  if (s.observedWeather && (c.visibility < 2 || c.wind > 55))
    result.push({
      key: "observed-weather",
      title: "Field restriction observed",
      detail: `${c.wind.toFixed(1)} km/h wind · ${c.visibility.toFixed(1)} km visibility`,
      priority: "caution",
      scope: "monitoring",
      route: "/monitoring",
      action: "Inspect observed conditions",
    });
  if (!s.observedWeather && s.forecastReadyBasis === s.assumptionVersion) {
    const h = Array.from({ length: Math.max(0, 49 - s.hour) }, (_, i) => s.hour + i).find((h) => {
      const e = environmentalPoint(h, s.inputs);
      return e.visibility < 2 || e.wind > 55;
    });
    if (h !== undefined)
      result.push({
        key: `forecast-restriction-${s.assumptionVersion}`,
        title: "Restricted field conditions forecast",
        detail: `Predicted from ${stationTime(h)}; not yet an observation`,
        priority: "caution",
        scope: "forecast",
        route: "/forecast",
        action: "Inspect updated outlook",
      });
  }
  if (s.responseRequired)
    result.push({
      key: `response-${s.activeVersion}-${s.assumptionVersion}-${s.generatorEvent?.hour ?? "outlook"}`,
      title: "Planning response required",
      detail: "Active schedule requires reassessment against available resources",
      priority: "warning",
      scope: "planning",
      route: "/mission-planner",
      action: s.proposal ? "Open revision in Mission Planner" : "Generate planning response",
    });
  const issue = s.activations.at(-1)!;
  if (
    s.forecastReadyBasis === s.assumptionVersion &&
    JSON.stringify(issue.inputs) !== JSON.stringify(s.inputs)
  )
    result.push({
      key: `basis-${s.assumptionVersion}-${s.activeVersion}`,
      title: "Active plan uses earlier assumptions",
      detail: `V${s.activeVersion} remains in force; revised outlook is available`,
      priority: "caution",
      scope: "planning",
      route: "/mission-planner",
      action: "Assess planning response",
    });
  if (s.uplink === "lost")
    result.push({
      key: "uplink-lost",
      title: "External link unavailable",
      detail: "Local case workspace remains available; external receipt is paused",
      priority: "caution",
      scope: "connection",
      route: "/",
      action: "Open connectivity",
    });
  if (s.hour - s.externalForecastHour >= 24)
    result.push({
      key: `forecast-age-${s.externalForecastHour}`,
      title: "External forecast receipt is stale",
      detail: `${s.hour - s.externalForecastHour}h since modeled receipt`,
      priority: "advisory",
      scope: "connection",
      route: "/forecast",
      action: "Inspect forecast freshness",
    });
  return result;
}
function reconcile(s: WorkflowState, a: WorkflowAction): WorkflowState {
  const wanted = conditions(s),
    keys = new Set(wanted.map((n) => n.key));
  let next = {
    ...s,
    attention: s.attention.map((n) =>
      n.condition && n.active && !keys.has(n.key) ? { ...n, active: false } : n,
    ),
  };
  for (const n of wanted) {
    const old = [...next.attention]
      .reverse()
      .find((item) => item.condition && item.active && item.key === n.key);
    if (!old) next = notice(next, n, a, true);
    else
      next = {
        ...next,
        attention: next.attention.map((item) =>
          item.id === old.id ? { ...item, detail: n.detail, action: n.action } : item,
        ),
      };
  }
  return next;
}
export function initializeWorkflow(base = initialPresentation()): WorkflowState {
  return reconcile(
    {
      ...base,
      workflow: 1,
      failedPreparation: null,
      sequence: 0,
      preparation: null,
      forecastReadyBasis: base.assumptionVersion,
      readyInputs: { ...base.inputs },
      comparisonReady: !!base.proposal,
      responseRequired: false,
      attention: [],
    },
    { type: "reset" },
  );
}
export function restoreWorkflow(raw: unknown): WorkflowState {
  const base = restorePresentation(raw);
  const value = raw as Partial<WorkflowState> | null;
  if (
    base !== raw ||
    !value ||
    value.workflow !== 1 ||
    (value.failedPreparation !== undefined &&
      value.failedPreparation !== null &&
      !["plan", "forecast", "assessment"].includes(value.failedPreparation)) ||
    (value.preparation !== undefined &&
      value.preparation !== null &&
      (!Number.isSafeInteger(value.preparation.token) ||
        !["plan", "forecast", "assessment"].includes(value.preparation.kind))) ||
    !validInputs(value.readyInputs as ScenarioInputs) ||
    !Number.isSafeInteger(value.sequence) ||
    (value.sequence ?? -1) < 0 ||
    !Array.isArray(value.attention) ||
    value.attention.length > 10000 ||
    new Set(value.attention.map((n) => n?.id)).size !== value.attention.length ||
    value.attention.some(
      (n) =>
        !n ||
        typeof n.id !== "string" ||
        typeof n.key !== "string" ||
        typeof n.title !== "string" ||
        typeof n.detail !== "string" ||
        !["advisory", "caution", "warning", "critical"].includes(n.priority) ||
        !["planning", "forecast", "monitoring", "connection"].includes(n.scope) ||
        !["/", "/forecast", "/monitoring", "/mission-planner"].includes(n.route) ||
        typeof n.action !== "string" ||
        typeof n.active !== "boolean" ||
        typeof n.acknowledged !== "boolean" ||
        typeof n.condition !== "boolean" ||
        !Number.isInteger(n.hour) ||
        n.hour < 0 ||
        n.hour > base.hour ||
        !Number.isSafeInteger(n.sequence) ||
        n.sequence > value.sequence!,
    ) ||
    !Number.isInteger(value.forecastReadyBasis) ||
    value.forecastReadyBasis! < 1 ||
    value.forecastReadyBasis! > base.assumptionVersion ||
    typeof value.comparisonReady !== "boolean" ||
    typeof value.responseRequired !== "boolean"
  )
    return initializeWorkflow(base);
  let restored: WorkflowState = {
    ...base,
    workflow: 1,
    sequence: value.sequence!,
    preparation: null,
    forecastReadyBasis: value.forecastReadyBasis!,
    readyInputs: value.readyInputs!,
    failedPreparation:
      value.preparation?.kind ??
      value.failedPreparation ??
      (value.forecastReadyBasis !== base.assumptionVersion ? "forecast" : null),
    comparisonReady: value.comparisonReady!,
    responseRequired: value.responseRequired!,
    attention: value.attention,
  };
  if (value.preparation)
    restored = notice(
      restored,
      {
        key: "interrupted",
        title: "Preparation interrupted by reload",
        detail: "No pending result was published. Retry preparation using retained applied inputs.",
        priority: "advisory",
        scope: "planning",
        route: "/mission-planner",
        action: "Inspect planning workspace",
      },
      { type: "reset" },
    );
  return reconcile(restored, { type: "reset" });
}
function start(s: WorkflowState, kind: PreparationKind): WorkflowState {
  const sequence = s.sequence + 1;
  return {
    ...s,
    failedPreparation: null,
    sequence,
    preparation: { token: sequence, kind, basis: s.assumptionVersion, hour: s.hour },
  };
}
export function workflowReducer(s: WorkflowState, a: WorkflowAction): WorkflowState {
  if (a.type === "reset") return { ...initializeWorkflow(), sequence: s.sequence + 100 };
  if (a.type === "ack-attention") {
    if (!s.attention.some((n) => n.id === a.id && !n.acknowledged)) return s;
    return {
      ...s,
      attention: s.attention.map((n) => (n.id === a.id ? { ...n, acknowledged: true } : n)),
    };
  }
  if (a.type === "fail-task") {
    if (s.preparation?.token !== a.token) return s;
    return notice(
      { ...s, preparation: null, failedPreparation: s.preparation!.kind },
      {
        key: `failed-${a.token}`,
        title: "Preparation could not complete",
        detail: "Active plan retained; retry after inspecting the case",
        priority: "warning",
        scope: "planning",
        route: "/mission-planner",
        action: "Inspect workspace",
      },
      a,
    );
  }
  if (a.type === "retry-task") {
    if (!s.failedPreparation || s.preparation || s.proposal) return s;
    return start(s, s.failedPreparation);
  }
  if (a.type === "complete-task") {
    const task = s.preparation;
    if (
      !task ||
      task.token !== a.token ||
      task.basis !== s.assumptionVersion ||
      task.hour !== s.hour ||
      !Number.isFinite(a.elapsedMs) ||
      a.elapsedMs < PREPARATION_MS[task.kind]
    )
      return s;
    let next: WorkflowState = { ...s, preparation: null };
    if (task.kind === "plan") {
      next = { ...next, ...presentationReducer(next, { type: "generate" }), comparisonReady: true };
      const feasible = next.proposal?.feasible;
      next = notice(
        next,
        {
          key: `proposal-${a.token}`,
          title: feasible
            ? `Proposal V${next.proposal!.version} ready`
            : "Proposal cannot be authorized",
          detail: feasible
            ? "Inspect schedule, dispatch and reserve trade-offs before authorizing"
            : (next.proposal?.problems.join("; ") ?? "No result available"),
          priority: feasible ? "advisory" : "warning",
          scope: "planning",
          route: "/mission-planner",
          action: "Open proposal in Mission Planner",
        },
        a,
        false,
        a.elapsedMs,
      );
    } else if (task.kind === "forecast") {
      next = {
        ...next,
        forecastReadyBasis: s.assumptionVersion,
        readyInputs: { ...s.inputs },
        responseRequired: !planAssessment(s, s.activeSchedule, s.activeKind).feasible,
      };
      next = notice(
        next,
        {
          key: `forecast-ready-${task.basis}`,
          title: "Forecast updated",
          detail: `Assumption revision ${task.basis} available; active V${s.activeVersion} retained`,
          priority: "advisory",
          scope: "forecast",
          route: "/forecast",
          action: "Inspect updated forecast",
        },
        a,
        false,
        a.elapsedMs,
      );
    } else {
      const assessment = planAssessment(next, next.activeSchedule, next.activeKind);
      next = { ...next, responseRequired: !assessment.feasible };
      next = notice(
        next,
        {
          key: `assessment-${a.token}`,
          title: assessment.feasible
            ? "Active plan assessment complete"
            : "Active plan needs a response",
          detail: assessment.feasible
            ? "No replacement required by this assessment; continue inspecting execution"
            : assessment.problems.join("; "),
          priority: assessment.feasible ? "advisory" : "warning",
          scope: "monitoring",
          route: assessment.feasible ? "/monitoring" : "/mission-planner",
          action: assessment.feasible ? "Inspect execution" : "Assess planning response",
        },
        a,
        false,
        a.elapsedMs,
      );
    }
    return reconcile(next, a);
  }
  if (a.type === "advance" && s.responseRequired) return s;
  if (a.type === "generate") {
    if (
      s.preparation ||
      s.proposal ||
      s.hour >= STATION.playbackEnd ||
      s.forecastReadyBasis !== s.assumptionVersion
    )
      return s;
    return start({ ...s, comparisonReady: false }, "plan");
  }
  if (
    s.preparation &&
    [
      "advance",
      "observe-weather",
      "generator-event",
      "review",
      "approve",
      "activate",
      "reject",
    ].includes(a.type)
  )
    return s;
  const base = presentationReducer(s, a);
  if (base === s) return s;
  let next: WorkflowState = { ...s, ...base };
  if (a.type === "apply-outlook") {
    next = {
      ...next,
      comparisonReady: false,
      preparation: null,
      attention: next.attention.map((n) =>
        n.key.startsWith("forecast-ready-") || n.key.startsWith("inputs-")
          ? { ...n, active: false }
          : n,
      ),
    };
    next = notice(
      next,
      {
        key: `inputs-${next.assumptionVersion}`,
        title: "Future inputs applied",
        detail: `Additional delay +${next.inputs.resupplyDelay} days; revised arrival ${stationTime(STATION.resupplyHour + next.inputs.resupplyDelay * 24)}. Forecast refresh preparing.`,
        priority: "advisory",
        scope: "forecast",
        route: "/forecast",
        action: "Inspect forecast status",
      },
      a,
    );
    next = start(next, "forecast");
  }
  if (a.type === "generator-event") {
    next = { ...next, comparisonReady: false };
    next = notice(
      next,
      {
        key: "generator-observed",
        title: "Generator 01 capacity loss observed",
        detail: `${currentStation(next).g1Capacity} / ${STATION.generatorOne} kW available; active-plan assessment preparing`,
        priority: "caution",
        scope: "monitoring",
        route: "/monitoring",
        action: "Inspect capacity impact",
      },
      a,
    );
    next = start(next, "assessment");
  }
  if (a.type === "observe-weather")
    next = notice(
      next,
      {
        key: "weather-observed",
        title: "Weather observation recorded",
        detail: `${currentStation(next).wind.toFixed(1)} km/h · ${currentStation(next).temperature.toFixed(1)}°C; earlier observations retained`,
        priority: "advisory",
        scope: "monitoring",
        route: "/monitoring",
        action: "Compare observation with reference",
      },
      a,
    );
  if (a.type === "activate") {
    next = {
      ...next,
      responseRequired: false,
      attention: next.attention.map((n) =>
        n.key.startsWith("proposal-") || n.key.startsWith("assessment-")
          ? { ...n, active: false }
          : n,
      ),
    };
    next = notice(
      next,
      {
        key: `activated-${next.activeVersion}`,
        title: `Plan V${next.activeVersion} activated`,
        detail: "Current inventory and executed work retained; projected dispatch updated",
        priority: "advisory",
        scope: "planning",
        route: "/",
        action: "Inspect station dashboard",
      },
      a,
    );
  }
  if (a.type === "reject")
    next = {
      ...next,
      comparisonReady: false,
      attention: next.attention.map((n) =>
        n.key.startsWith("proposal-") ? { ...n, active: false } : n,
      ),
    };
  if (a.type === "advance") next = { ...next, comparisonReady: false };
  if (["uplink", "receive-forecast", "synchronize"].includes(a.type))
    next = notice(
      next,
      {
        key: `connection-${next.sequence + 1}`,
        title:
          a.type === "uplink"
            ? next.uplink === "lost"
              ? "External link lost"
              : "External link restored"
            : a.type === "receive-forecast"
              ? "External forecast receipt recorded"
              : "External decisions acknowledged",
        detail:
          "Forecast receipt, alert acknowledgement and decision synchronization remain separate",
        priority: "advisory",
        scope: "connection",
        route: "/",
        action: "Open connectivity",
      },
      a,
    );
  return reconcile(next, a);
}
export function attentionItems(s: WorkflowState, scope?: Attention["scope"], history = false) {
  const ranks = { critical: 0, warning: 1, caution: 2, advisory: 3 };
  return s.attention
    .filter(
      (n) =>
        (!scope || n.scope === scope) &&
        (history || (n.active && (n.condition || !n.acknowledged))),
    )
    .sort((a, b) => ranks[a.priority] - ranks[b.priority] || b.sequence - a.sequence);
}
export function forecastCase(s: WorkflowState): PresentationState {
  return s.forecastReadyBasis === s.assumptionVersion
    ? s
    : {
        ...s,
        inputs: s.readyInputs,
        outlookChanged: s.readyInputs.resupplyDelay > 0 || s.readyInputs.weatherSeverity > 0,
      };
}
