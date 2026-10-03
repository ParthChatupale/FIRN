import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  Bell,
  ChartNoAxesCombined,
  ChevronRight,
  CloudSnow,
  Compass,
  Gauge,
  Hexagon,
  LayoutDashboard,
  Menu,
  Radio,
  ScanLine,
  SlidersHorizontal,
  X,
  Settings,
  Info,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useFirn } from "@/lib/firn-context";
import type { ScenarioId } from "@/lib/firn-data";
import { getApiHealth, getMonitoringSession, getPlan, getSimulationRun } from "@/lib/firn-api";
import { useOperatingWorkspace } from "@/lib/use-operating-workspace";
import { formatRecordTime, formatTemperature, formatWind } from "@/lib/workspace-model";

// Tag each response with its selection and refresh so old evidence cannot appear under a new ID.
function useBackendRecord<T>(
  id: string | null,
  fetcher: (id: string) => Promise<T>,
  refresh: string,
) {
  const key = JSON.stringify([id, refresh]);
  const [result, setResult] = useState<{
    key: string;
    data: T | null;
    error: string | null;
    checkedAt: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    fetcher(id)
      .then((data) => {
        if (!cancelled) setResult({ key, data, error: null, checkedAt: new Date().toISOString() });
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setResult({
            key,
            data: null,
            error: reason instanceof Error ? reason.message : "Could not retrieve backend data.",
            checkedAt: new Date().toISOString(),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [id, fetcher, key]);
  const current = id && result?.key === key ? result : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: !!id && !current,
    checkedAt: current?.checkedAt ?? null,
  };
}

function utcDate(value: string | null | undefined) {
  if (!value) return "No timestamp available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Invalid backend timestamp"
    : date
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d{3}Z$/, " UTC");
}

const nav = [
  { to: "/", label: "Operations", icon: LayoutDashboard },
  { to: "/mission-planner", label: "Mission Planner", icon: Compass },
  { to: "/monitoring", label: "Monitoring", icon: ScanLine },
  { to: "/energy-assets", label: "Energy & Assets", icon: Gauge },
  { to: "/forecast", label: "Look ahead", icon: ChartNoAxesCombined },
  { to: "/scenario-simulator", label: "Scenario Simulator", icon: SlidersHorizontal },
  { to: "/decision-log", label: "Decision Log", icon: Activity },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const {
    runId,
    planId,
    monitoringId,
    workflowLoaded,
    workflowRevision,
    reasoningOpen,
    setReasoningOpen,
    preferences,
    operator,
    setRunId,
    setPlanId,
    setMonitoringId,
  } = useFirn();
  const workspace = useOperatingWorkspace();
  const utcDate = (value: string | null | undefined) =>
    formatRecordTime(value, preferences.timezone);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  const refresh = JSON.stringify([
    pathname,
    revision,
    workflowRevision,
    noticesOpen,
    reasoningOpen,
  ]);
  const health = useBackendRecord("health", getApiHealth, refresh);
  const healthy = health.data?.status === "ok" && health.data?.database === "ok";
  const selectedRun = { loading: workspace.loading, error: workspace.error };
  const selectedPlan = selectedRun;
  const selectedSession = selectedRun;
  const { run, plan, session, planMismatch, sessionMismatch, cursor, activePlan } = workspace;
  const temperature = cursor.point?.temperature_c;
  const wind = cursor.point?.wind_kmh;
  const decisions = plan?.explanations.mission_decisions ?? [];
  const constraints = plan?.explanations.binding_constraint_evidence ?? [];
  const refreshButton = (
    <Button variant="outline" size="sm" onClick={() => setRevision((value) => value + 1)}>
      Refresh backend status
    </Button>
  );
  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[244px] flex-col border-r border-border bg-sidebar transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[78px] items-center justify-between border-b border-border px-6">
          <Link to="/" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
            <div className="flex size-9 items-center justify-center rounded-md border border-primary/50 bg-primary/10 text-primary">
              <Hexagon size={21} strokeWidth={1.8} />
            </div>
            <div>
              <div className="font-display text-[24px] font-extrabold leading-none tracking-normal">
                FIRN<span className="text-primary">.</span>
              </div>
              <div className="mt-1 text-[9px] font-semibold uppercase tracking-[.21em] text-muted-foreground">
                Operational intelligence
              </div>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X />
          </Button>
        </div>
        <div className="px-5 pt-9">
          <div className="micro-label px-3">Workspace</div>
          <nav className="mt-4 space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`group flex h-11 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                >
                  <Icon size={17} strokeWidth={1.8} />
                  <span>{item.label}</span>
                  {active && <span className="ml-auto h-5 w-0.5 rounded-full bg-primary" />}
                </Link>
              );
            })}
          </nav>
          <div className="mt-5 space-y-1 border-t border-border pt-3">
            <Link
              to="/settings"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded px-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Settings size={17} />
              Settings
            </Link>
            <Link
              to="/about"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded px-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Info size={17} />
              About & case details
            </Link>
          </div>
        </div>
        <div className="mt-auto p-5">
          <div className="rounded-md border border-border bg-card/70 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span
                className={`size-2 rounded-full ${healthy ? "bg-success" : health.loading ? "bg-muted-foreground" : "bg-destructive"}`}
              />
              {health.loading
                ? "Checking backend…"
                : health.error
                  ? "API unavailable"
                  : healthy
                    ? "Local node available"
                    : "Backend degraded"}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {health.error ??
                (health.data
                  ? `API: ${health.data.status} · Database: ${health.data.database}`
                  : "No health response available.")}
            </p>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Last checked: {utcDate(health.checkedAt)}
            </p>
            <div className="mt-3">{refreshButton}</div>
          </div>
          <div className="mt-4 text-center text-[10px] text-muted-foreground">
            <Link to="/about" className="hover:text-primary">
              Station model · Data sources
            </Link>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[78px] items-center justify-between border-b border-border bg-background/95 px-5 backdrop-blur-xl md:px-8 xl:px-10">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu />
            </Button>
            <div className="flex size-8 items-center justify-center rounded-md border border-border bg-secondary text-primary">
              <Radio size={16} />
            </div>
            <div>
              <div className="font-display text-sm font-bold">
                {run?.station_name ?? "FIRN operating workspace"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {!workflowLoaded
                  ? "Restoring selection…"
                  : selectedRun.loading
                    ? "Loading selected run…"
                    : selectedRun.error
                      ? "Selected run unavailable"
                      : run
                        ? `${run.scenario.replaceAll("_", " ")} · ${workspace.activeLoading ? "Checking active plan…" : workspace.activeError ? "Active plan unavailable" : activePlan ? `Active v${activePlan.version_number}${activePlan.source_simulation_run_id !== run.id ? " · another case" : ""}` : "No active plan"}`
                        : "No operating case selected"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-5">
            <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
              <CloudSnow size={15} className="text-primary" />
              {formatTemperature(temperature, preferences.temperatureUnit)}
              <span className="text-border">|</span> {formatWind(wind, preferences.windUnit)}
            </div>
            <div className="hidden h-7 w-px bg-border md:block" />
            <div className="hidden text-right text-[11px] leading-5 text-muted-foreground sm:block">
              <div className="font-semibold text-foreground">
                {utcDate(cursor.point?.timestamp)}
              </div>
              <div>{cursor.label}</div>
            </div>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                aria-expanded={noticesOpen}
                onClick={() => setNoticesOpen(!noticesOpen)}
              >
                <Bell size={18} />
              </Button>
              {noticesOpen && (
                <div className="absolute right-0 top-12 z-30 max-h-[70vh] w-72 overflow-y-auto rounded-md border border-border bg-popover p-4 shadow-xl">
                  <div className="micro-label">Saved monitoring events</div>
                  {!workflowLoaded || selectedSession.loading ? (
                    <p role="status" className="mt-2 text-sm">
                      Loading monitoring session…
                    </p>
                  ) : selectedSession.error ? (
                    <p role="alert" className="mt-2 text-sm text-destructive">
                      {selectedSession.error}
                    </p>
                  ) : sessionMismatch ? (
                    <p role="alert" className="mt-2 text-sm text-warning">
                      The selected session belongs to a different run. Its alerts are not shown
                      here.
                    </p>
                  ) : !session ? (
                    <p className="mt-2 text-sm">
                      No monitoring session selected. No alert data is available.
                    </p>
                  ) : (
                    <>
                      <p className="mt-2 break-all text-[10px] text-muted-foreground">
                        Session {session.id} · {session.status} · H{session.current_hour}
                        <br />
                        Plan {session.plan_version_id}
                        <br />
                        Updated {utcDate(session.updated_at)}
                      </p>
                      {session.events.length === 0 ? (
                        <p className="mt-3 text-sm">No events recorded for this session.</p>
                      ) : (
                        [...session.events]
                          .sort((a, b) => b.hour - a.hour)
                          .slice(0, 5)
                          .map((event) => (
                            <div key={event.id} className="mt-3 rounded border border-border p-3">
                              <StatusBadge
                                tone={
                                  event.severity === "critical" || event.severity === "high"
                                    ? "critical"
                                    : "warn"
                                }
                              >
                                {event.severity} · H{event.hour}
                              </StatusBadge>
                              <p className="mt-2 text-sm">{event.rule.replaceAll("_", " ")}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {event.action.replaceAll("_", " ")}
                              </p>
                              {event.proposal_plan_version_id && (
                                <p className="mt-1 break-all text-[10px] text-muted-foreground">
                                  Proposal: {event.proposal_plan_version_id}
                                </p>
                              )}
                            </div>
                          ))
                      )}
                      {session.events.length > 5 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Showing the latest 5 of {session.events.length} events.
                        </p>
                      )}
                    </>
                  )}
                  <div className="mt-3">{refreshButton}</div>
                  <Link
                    to="/decision-log"
                    onClick={() => setNoticesOpen(false)}
                    className="mt-3 inline-flex items-center gap-1 text-xs text-primary"
                  >
                    View Decision Log <ArrowUpRight size={13} />
                  </Link>
                </div>
              )}
            </div>
            <Link
              to="/login"
              aria-label="Operator profile"
              title={`${operator.name} · ${operator.role}`}
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-secondary text-xs font-bold text-primary hover:bg-primary/10"
            >
              {operator.name
                .split(/\s+/)
                .slice(0, 2)
                .map((word) => word[0])
                .join("")
                .toUpperCase()}
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-5 py-7 md:px-8 xl:px-10">
          {workspace.error && (
            <section role="alert" className="panel mb-5 border-destructive/30 p-4">
              <p className="text-sm text-destructive">{workspace.error}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={workspace.refresh}>
                  Retry workspace
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPlanId(null);
                    setMonitoringId(null);
                  }}
                >
                  Clear plan & monitoring selection
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRunId(null)}>
                  Clear case selection
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Saved backend records are not deleted.
              </p>
            </section>
          )}
          {workspace.error &&
          !["/scenario-simulator", "/settings", "/about", "/login"].includes(pathname) ? (
            <p className="text-sm text-muted-foreground">
              Resolve the selected case before continuing.
            </p>
          ) : workspace.loading &&
            runId &&
            !["/scenario-simulator", "/settings", "/login"].includes(pathname) ? (
            <p role="status" className="panel p-5 text-sm text-muted-foreground">
              Loading operating case and clock…
            </p>
          ) : null}
          <div
            hidden={Boolean(
              (workspace.error &&
                !["/scenario-simulator", "/settings", "/about", "/login"].includes(pathname)) ||
              (workspace.loading &&
                runId &&
                !["/scenario-simulator", "/settings", "/login"].includes(pathname)),
            )}
          >
            {children}
          </div>
          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border py-4 text-[11px] text-muted-foreground">
            <span>FIRN · Operator-reviewed decisions</span>
            <Link to="/about" className="hover:text-primary">
              Station model · Methodology & case details
            </Link>
          </footer>
        </main>
      </div>
      <Dialog open={reasoningOpen} onOpenChange={setReasoningOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-card p-7 text-foreground sm:p-9">
          <DialogHeader>
            <div className="micro-label text-primary">Explainable Decisions / FIRN engine</div>
            <DialogTitle className="mt-2 font-display text-2xl">
              Why did FIRN make this decision?
            </DialogTitle>
            <DialogDescription>
              Backend explanations for the selected plan version, using synthetic model inputs.
            </DialogDescription>
          </DialogHeader>
          {!workflowLoaded || selectedPlan.loading ? (
            <p role="status" className="mt-5 text-sm">
              Loading the selected plan’s explanations…
            </p>
          ) : selectedPlan.error ? (
            <p role="alert" className="mt-5 text-sm text-destructive">
              {selectedPlan.error}
            </p>
          ) : planMismatch ? (
            <p role="alert" className="mt-5 text-sm text-warning">
              The selected plan belongs to a different run. Choose a matching plan to view its
              reasoning here.
            </p>
          ) : !plan ? (
            <p className="mt-5 text-sm text-muted-foreground">
              No plan selected. Create or resume a run, then select a plan in Mission Planner to
              view saved explanations.
            </p>
          ) : (
            <>
              <div className="mt-5 rounded-md border border-primary/30 bg-primary/5 p-4">
                <div className="micro-label">Selected plan / v{plan.version_number}</div>
                <p className="mt-2 break-all text-sm">{plan.id}</p>
                <div className="mt-2">
                  <StatusBadge>{plan.status}</StatusBadge>
                </div>
                <p className="mt-2 break-all text-xs text-muted-foreground">
                  Source run: {plan.source_simulation_run_id ?? "not recorded"} ·{" "}
                  {plan.scenario.replaceAll("_", " ")} · seed {plan.seed} · {plan.days} days
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {plan.solver_name} {plan.solver_version} · {plan.planner_model_version}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  This is a saved plan explanation. Plan status is shown above; proposed decisions
                  are not executed actions.
                </p>
              </div>
              <div className="mt-5 micro-label">Mission decisions</div>
              {decisions.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No mission explanations were returned for this plan.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {decisions.map((decision, index) => (
                    <div key={index} className="rounded border border-border bg-secondary/40 p-3">
                      <div className="text-sm font-semibold">
                        {typeof decision["mission_id"] === "string"
                          ? decision["mission_id"]
                          : `Mission ${index + 1}`}{" "}
                        ·{" "}
                        {typeof decision["decision"] === "string"
                          ? decision["decision"].replaceAll("_", " ")
                          : "Decision not recorded"}
                      </div>
                      <p className="mt-1 text-sm">
                        {typeof decision["reason"] === "string"
                          ? decision["reason"]
                          : "No explanation recorded."}
                      </p>
                      {typeof decision["proposed_start_hour"] === "number" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Proposed start: H{decision["proposed_start_hour"]}
                          {typeof decision["original_start_hour"] === "number"
                            ? ` · original H${decision["original_start_hour"]}`
                            : ""}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-5 micro-label">Constraint evidence</div>
              {constraints.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No binding-constraint evidence was returned for this plan.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {constraints.map((constraint, index) => (
                    <div key={index} className="rounded border border-border bg-secondary/40 p-3">
                      <div className="micro-label">
                        {constraint.constraint.replaceAll("_", " ")}
                      </div>
                      <p className="mt-1 text-sm">{constraint.explanation}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Evidence hours:{" "}
                        {constraint.evidence_hours.length
                          ? constraint.evidence_hours.join(", ")
                          : "not recorded"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-4 text-[11px] text-muted-foreground">
                {plan.explanations.interpretation_limit ??
                  "No interpretation limit was returned. These explanations concern a synthetic model, not live station operations."}
              </p>
            </>
          )}
          <div className="mt-4">{refreshButton}</div>
        </DialogContent>
      </Dialog>
      <Toaster position="bottom-right" theme="dark" richColors />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="micro-label mb-2 text-primary">{eyebrow}</div>
        <h1 className="font-display text-2xl font-bold md:text-[30px]">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-[15px] font-bold">{children}</h2>
      {aside && <div className="text-xs text-muted-foreground">{aside}</div>}
    </div>
  );
}
export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "critical";
}) {
  const colors = {
    neutral: "bg-primary/10 text-primary border-primary/20",
    good: "bg-success/10 text-success border-success/20",
    warn: "bg-warning/10 text-warning border-warning/20",
    critical: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${colors[tone]}`}
    >
      {children}
    </span>
  );
}
export function ReasonButton({ children = "View Decision Reasoning" }: { children?: ReactNode }) {
  const { setReasoningOpen } = useFirn();
  return (
    <Button
      variant="outline"
      onClick={() => setReasoningOpen(true)}
      className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 hover:text-primary"
    >
      {children}
      <ChevronRight size={14} />
    </Button>
  );
}
export function ScenarioChip({ id }: { id: ScenarioId }) {
  const { setScenario, scenarioId } = useFirn();
  const labels: Record<ScenarioId, string> = {
    normal: "Normal Conditions",
    storm: "Severe Storm",
    generator: "Generator Failure",
    fuel: "Fuel Resupply Delay",
    battery: "Low Battery Capacity",
  };
  return (
    <Button
      variant={scenarioId === id ? "default" : "outline"}
      onClick={() => setScenario(id)}
      className={`h-auto min-h-10 whitespace-normal px-4 py-2 text-xs ${scenarioId === id ? "" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
    >
      {labels[id]}
    </Button>
  );
}
