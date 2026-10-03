import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  BatteryCharging,
  BookOpen,
  CloudSnow,
  Compass,
  Hexagon,
  LayoutDashboard,
  Menu,
  Radio,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { usePresentation } from "@/lib/presentation-context";
import { currentStation, stationTime } from "@/lib/presentation-model";
import { PresentationScreen } from "./presentation-workspace";
import { RecordingConnectivity } from "./recording-connectivity";
import { NotificationButton, PreparationStatus } from "./recording-attention";

const nav = [
  { to: "/", label: "Operations", icon: LayoutDashboard },
  { to: "/mission-planner", label: "Mission Planner", icon: Compass },
  { to: "/forecast", label: "Look ahead", icon: Wind },
  { to: "/monitoring", label: "Monitoring", icon: Activity },
  { to: "/energy-assets", label: "Energy & Assets", icon: BatteryCharging },
  { to: "/scenario-simulator", label: "Scenario Simulator", icon: SlidersHorizontal },
  { to: "/decision-log", label: "Decision Log", icon: BookOpen },
] as const;
export const PRESENTATION_ROUTES = nav.map((n) => n.to) as readonly string[];

export function PresentationShell() {
  const { state, dispatch, storageWarning } = usePresentation();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const current = currentStation(state);
  const [drawer, setDrawer] = useState<"sources" | "connection" | null>(null);
  const [menu, setMenu] = useState(false);
  return (
    <div className="firn-studio">
      <a className="studio-skip" href="#station-workspace">
        Skip to workspace
      </a>
      {menu && (
        <button
          className="studio-menu-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`studio-sidebar ${menu ? "is-open" : ""}`}>
        <Link to="/" className="studio-brand">
          <Hexagon size={31} strokeWidth={1.4} />
          <span>
            FIRN<span className="studio-brand-dot">.</span>
            <small>OPERATIONAL INTELLIGENCE</small>
          </span>
        </Link>
        <div className="studio-nav-caption">STATION WORKSPACE</div>
        <nav aria-label="Station navigation">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setMenu(false)}
              className={path === n.to ? "studio-nav active" : "studio-nav"}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {path === n.to && <i />}
            </Link>
          ))}
        </nav>
        <div className="studio-sidebar-bottom">
          <button className="studio-nav" onClick={() => setDrawer("connection")}>
            <Wifi size={18} />
            Connectivity
            <span className={`studio-status-dot ${state.uplink === "lost" ? "amber" : ""}`} />
          </button>
          <Link className="studio-nav" to="/settings">
            <Settings size={18} />
            Settings
          </Link>
          <button className="studio-source-tile" onClick={() => setDrawer("sources")}>
            <Radio size={17} />
            <span>
              Station data<small>Scenario workspace · Sources</small>
            </span>
            <ArrowUpRight size={15} />
          </button>
          <div className="studio-station-id">
            ALPHA / 01 <span>MISSION-AWARE RESILIENCE</span>
          </div>
        </div>
      </aside>
      <div className="studio-body">
        <header className="studio-topbar">
          <button
            className="studio-mobile-menu studio-icon-button"
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
          >
            <Menu size={20} />
          </button>
          <div className="studio-station-heading">
            <span className="studio-radio">
              <Radio size={18} />
            </span>
            <div>
              Polar Station Alpha
              <small>
                <span className="studio-status-dot" /> Active plan V{state.activeVersion}{" "}
                <span>
                  ·{" "}
                  {state.proposal
                    ? `V${state.proposal.version} awaiting decision`
                    : state.activeKind === "original"
                      ? "Original mission schedule"
                      : "Joint mission–energy operations"}
                </span>
              </small>
            </div>
          </div>
          <div className="studio-header-weather">
            <CloudSnow size={18} />
            <strong>{current.temperature.toFixed(1)}°C</strong>
            <span>{current.wind.toFixed(0)} km/h</span>
          </div>
          <div className="studio-clock">
            <strong>{stationTime(state.hour)}</strong>
            <small>
              Operating hour H{state.hour} <span>· 48h case</span>
            </small>
          </div>
          <button
            className={`studio-icon-button ${state.uplink === "lost" ? "text-amber" : ""}`}
            aria-label="Open connectivity"
            onClick={() => setDrawer("connection")}
          >
            {state.uplink === "connected" ? <Wifi size={19} /> : <WifiOff size={19} />}
          </button>
          <Link to="/login" className="studio-avatar" aria-label="Open existing operator profile">
            OP
          </Link>
          <NotificationButton onConnectivity={() => setDrawer("connection")} />
        </header>
        <main id="station-workspace" className="studio-main">
          {storageWarning && (
            <p role="status" className="studio-storage-warning">
              Browser storage unavailable. This presentation remains usable, but reload may reset
              it.
            </p>
          )}
          <PresentationScreen path={path} />
          {state.preparation &&
            path !== "/mission-planner" &&
            path !== "/forecast" &&
            path !== "/monitoring" && <PreparationStatus />}
        </main>
      </div>
      {drawer === "connection" && <RecordingConnectivity close={() => setDrawer(null)} />}
      {drawer === "sources" && (
        <div className="studio-modal-backdrop" onClick={() => setDrawer(null)}>
          <section
            className="studio-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={drawer === "sources" ? "Station data sources" : "Connectivity details"}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDrawer(null);
              if (e.key === "Tab") {
                const controls = e.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled),a[href],input,select",
                );
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <header>
              <div>
                <div className="studio-eyebrow">INTEGRATION LAYER</div>
                <h2>
                  {drawer === "sources" ? "Station data sources" : "Local & external connectivity"}
                </h2>
              </div>
              <button
                autoFocus
                className="studio-icon-button"
                aria-label="Close details"
                onClick={() => setDrawer(null)}
              >
                <X size={20} />
              </button>
            </header>
            {drawer === "sources" ? (
              <>
                <p>One station-data model for weather, power, resources and equipment status.</p>
                {[
                  {
                    icon: Wind,
                    title: "Weather & visibility",
                    detail: "Temperature · wind · field access",
                  },
                  {
                    icon: Zap,
                    title: "Energy telemetry",
                    detail: "Generation · demand · battery state",
                  },
                  {
                    icon: BatteryCharging,
                    title: "Resource inventory",
                    detail: "Battery reserve · fuel · resupply",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Equipment state",
                    detail: "Availability · capacity · assignment",
                  },
                ].map((d) => (
                  <div className="studio-source-row" key={d.title}>
                    <d.icon size={19} />
                    <div>
                      <strong>{d.title}</strong>
                      <small>{d.detail}</small>
                    </div>
                    <span className="studio-chip">Station model</span>
                  </div>
                ))}
                <div className="studio-note">
                  <strong>Sensor-network integration</strong>
                  <p>
                    Adapter-based integration is the intended hardware pathway. Physical sensor
                    adapters are planned, not connected.
                  </p>
                </div>
                <div className="studio-note">
                  <strong>Presentation boundary</strong>
                  <p>
                    This workspace uses a deterministic illustrative model and browser-local
                    decision records. It does not call the backend, run its optimizer, control
                    equipment or measure real forecasting performance.
                  </p>
                  <a href="/?workspace=backend">Open the existing connected workspace ↗</a>
                </div>
              </>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
