import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  ChevronRight,
  Compass,
  FolderOpen,
  Hexagon,
  Info,
  LayoutDashboard,
  Menu,
  ScanLine,
  SlidersHorizontal,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CaseLibrary } from "./case-library";
import { useFirn } from "@/lib/firn-context";
import { useOperatingWorkspace } from "@/lib/use-operating-workspace";
import { getApiHealth } from "@/lib/firn-api";
import { formatUtc, humanize, number } from "@/lib/display";

const nav = [
  { to: "/", label: "Operations", icon: LayoutDashboard },
  { to: "/plan", label: "Plan", icon: Compass },
  { to: "/monitor", label: "Monitor", icon: ScanLine },
  { to: "/scenario-lab", label: "Scenario Lab", icon: SlidersHorizontal },
  { to: "/decision-record", label: "Decision Record", icon: Activity },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const workspace = useOperatingWorkspace();
  const { setCaseLibraryOpen, selectWorkflow } = useFirn();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const health = useQuery({
    queryKey: ["api-health"],
    queryFn: getApiHealth,
    enabled: detailsOpen,
    retry: false,
    staleTime: 15_000,
  });
  const { run, snapshot: s, session } = workspace;
  const weather = s.point;
  const events = (session?.events ?? [])
    .filter((event) => event.hour <= s.hour)
    .sort((a, b) => b.hour - a.hour);
  return (
    <div className="firn-app">
      <a href="#workspace" className="skip-link">
        Skip to workspace
      </a>
      {mobileOpen && (
        <button
          className="mobile-shade"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`firn-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <Link to="/" className="firn-brand" onClick={() => setMobileOpen(false)}>
          <Hexagon size={28} strokeWidth={1.3} />
          <span>
            FIRN<span className="brand-dot">.</span>
            <small>OPERATIONAL INTELLIGENCE</small>
          </span>
        </Link>
        <div className="sidebar-label">WORKSPACE</div>
        <nav aria-label="Primary navigation">
          {nav.map((item, index) => (
            <Link
              key={item.to}
              to={item.to}
              className={pathname === item.to ? "is-active" : ""}
              onClick={() => setMobileOpen(false)}
              aria-current={pathname === item.to ? "page" : undefined}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
              <small>{String(index + 1).padStart(2, "0")}</small>
            </Link>
          ))}
        </nav>
        <div className="sidebar-context">
          <div className="sidebar-label">OPERATING BASIS</div>
          <strong>{run?.station_name ?? "No case selected"}</strong>
          <p>{run ? `${run.duration_days}-day horizon` : "Open a saved operating case"}</p>
          <button onClick={() => setCaseLibraryOpen(true)} className="text-button">
            <FolderOpen size={14} /> Change case
          </button>
        </div>
        <button onClick={() => setDetailsOpen(true)} className="sidebar-method">
          <Info size={14} /> Case & methodology
        </button>
      </aside>
      <div className="firn-main">
        <header className="firn-topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="topbar-case">
            <span className="station-symbol">
              <Compass size={18} />
            </span>
            <div>
              <strong>{run?.station_name ?? "Station workspace"}</strong>
              <button className="case-switch" onClick={() => setCaseLibraryOpen(true)}>
                {workspace.error
                  ? "Evidence unavailable"
                  : run
                    ? humanize(run.scenario)
                    : "Choose an operating case"}
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
          <div className="topbar-plan">
            <span className="micro-label">ACTIVE PLAN</span>
            <strong>
              {s.activePlan ? `Version ${s.activePlan.version_number}` : "Not established"}
            </strong>
          </div>
          <div className="topbar-weather">
            {weather ? (
              <>
                <strong>
                  {typeof weather.temperature_c === "number"
                    ? `${number(weather.temperature_c)} °C`
                    : "Temperature unavailable"}
                </strong>
                <span>
                  {typeof weather.wind_kmh === "number"
                    ? `${number(weather.wind_kmh)} km/h wind`
                    : "Wind unavailable"}
                </span>
              </>
            ) : (
              <span>Weather unavailable</span>
            )}
          </div>
          <div className="topbar-clock">
            <strong>{formatUtc(s.timestamp)}</strong>
            <span>{s.clockLabel}</span>
          </div>
          <button
            className="icon-button notice-button"
            aria-label="Open monitoring records"
            onClick={() => setEventsOpen(true)}
          >
            <Bell size={18} />
            {s.currentEvents.length > 0 && <span>{s.currentEvents.length}</span>}
          </button>
          <button
            className="icon-button"
            aria-label="Case details and methodology"
            onClick={() => setDetailsOpen(true)}
          >
            <Info size={18} />
          </button>
          <span className="operator-avatar" aria-label="Station operator">
            OP
          </span>
        </header>
        <main id="workspace" tabIndex={-1} className="firn-content">
          {children}
        </main>
      </div>
      <CaseLibrary />
      <Modal
        open={eventsOpen}
        onOpenChange={setEventsOpen}
        title="Monitoring records"
        description="Historical events through the displayed hour. Recorded events are not necessarily unresolved alerts."
      >
        {!session ? (
          <p className="ops-empty">No monitoring session is selected.</p>
        ) : (
          <div className="record-list">
            {events.length ? (
              events.map((event) => (
                <article key={event.id}>
                  <StatusBadge
                    tone={
                      event.severity === "high" || event.severity === "critical"
                        ? "critical"
                        : "warn"
                    }
                  >
                    {event.severity} · H{event.hour}
                  </StatusBadge>
                  <h3>{humanize(event.rule)}</h3>
                  <p>{humanize(event.action)}</p>
                </article>
              ))
            ) : (
              <p className="ops-empty">No monitoring events recorded through H{s.hour}.</p>
            )}
          </div>
        )}
      </Modal>
      <Modal
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        title="Case & methodology"
        description="Operating evidence, model boundaries, and service diagnostics."
      >
        <div className="methodology-note">
          <h3>Modeled station environment</h3>
          <p>
            Inputs and telemetry come from the synthetic station model, not physical station sensors
            or controls. Case review reads saved observations; it does not execute the proposed
            dispatch.
          </p>
          <p>
            Plan trajectories are optimizer projections. Monitoring replays the stored base case and
            compares it with a plan; it does not enact that plan's dispatch. No autonomous
            activation occurs.
          </p>
        </div>
        <dl className="case-facts">
          <dt>Source case</dt>
          <dd>{run?.id ?? "None selected"}</dd>
          <dt>Model / seed</dt>
          <dd>{run ? `${run.simulator_version} / ${run.seed}` : "Unavailable"}</dd>
          <dt>Selected plan</dt>
          <dd>
            {workspace.selectedPlan
              ? `${workspace.selectedPlan.id} · ${workspace.selectedPlan.status}`
              : "None selected"}
          </dd>
          <dt>Monitoring session</dt>
          <dd>{session ? `${session.id} · ${session.status}` : "None selected"}</dd>
          <dt>Last retrieved</dt>
          <dd>
            {workspace.checkedAt
              ? formatUtc(new Date(workspace.checkedAt).toISOString())
              : "Not retrieved"}
          </dd>
          <dt>API / database</dt>
          <dd>
            {health.isPending
              ? "Checking…"
              : health.error
                ? health.error.message
                : `${health.data?.status ?? "Unavailable"} / ${health.data?.database ?? "Unavailable"}`}
          </dd>
        </dl>
        <div className="library-actions">
          <Button
            variant="outline"
            onClick={() => {
              void health.refetch();
              workspace.refresh();
            }}
          >
            Refresh evidence
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              selectWorkflow({ runId: null, planId: null, monitoringId: null });
              setDetailsOpen(false);
            }}
          >
            Clear selection
          </Button>
        </div>
      </Modal>
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
  return <span className={`status-badge tone-${tone}`}>{children}</span>;
}
