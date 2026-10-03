import { Radio, Wifi, WifiOff, X } from "lucide-react";
import { usePresentation } from "@/lib/presentation-context";
import { stationTime } from "@/lib/presentation-model";

/** Non-modal tray. No scrim, focus trap, cloud health claim or fake receipt on reconnect. */
export function RecordingConnectivity({ close }: { close: () => void }) {
  const { state, dispatch } = usePresentation();
  const queued = state.records.filter((r) => r.sync === "queued");
  return (
    <aside
      className="recording-connection"
      aria-label="Connectivity controls"
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <header>
        <div>
          <small>STATION / EXTERNAL LINK</small>
          <h2>Connectivity</h2>
        </div>
        <button className="studio-icon-button" aria-label="Close connectivity" onClick={close}>
          <X size={18} />
        </button>
      </header>
      <div className="recording-link-state">
        <Radio size={18} />
        <div>
          <strong>Local case engine</strong>
          <small>Execution · planning · decision history</small>
        </div>
        <span className="studio-chip good">Available</span>
      </div>
      <div className="recording-link-state">
        {state.uplink === "lost" ? <WifiOff size={18} /> : <Wifi size={18} />}
        <div>
          <strong>External uplink</strong>
          <small>Modeled provider connection</small>
        </div>
        <span className={`studio-chip ${state.uplink === "lost" ? "warn" : "good"}`}>
          {state.uplink === "lost" ? "Unavailable" : "Connected"}
        </span>
      </div>
      <dl className="recording-link-metrics">
        <div>
          <dt>Forecast received</dt>
          <dd>{stationTime(state.externalForecastHour)}</dd>
        </div>
        <div>
          <dt>Forecast age</dt>
          <dd className={state.hour - state.externalForecastHour >= 24 ? "text-amber" : ""}>
            {state.hour - state.externalForecastHour} operating hours
          </dd>
        </div>
        <div>
          <dt>Link transition / contact</dt>
          <dd>{stationTime(state.lastContactHour)}</dd>
        </div>
        <div>
          <dt>Decision acknowledgement</dt>
          <dd>
            {state.lastAcknowledgedHour === null
              ? "None yet"
              : stationTime(state.lastAcknowledgedHour)}
          </dd>
        </div>
        <div>
          <dt>Outbox</dt>
          <dd>{queued.length} queued decision / event records</dd>
        </div>
      </dl>
      <button className="studio-button" onClick={() => dispatch({ type: "uplink" })}>
        {state.uplink === "connected" ? "Model external outage" : "Restore external uplink"}
      </button>
      <div className="studio-action-row">
        <button
          className="studio-button secondary"
          disabled={state.uplink !== "connected" || state.externalForecastHour === state.hour}
          onClick={() => dispatch({ type: "receive-forecast" })}
        >
          Receive forecast
        </button>
        <button
          className="studio-button secondary"
          disabled={state.uplink !== "connected" || !queued.length}
          onClick={() => dispatch({ type: "synchronize" })}
        >
          Acknowledge {queued.length} {queued.length === 1 ? "record" : "records"}
        </button>
      </div>
      <details className="studio-values">
        <summary>Inspect synchronization outbox</summary>
        <div className="studio-outbox">
          {state.records
            .filter((r) => r.sync !== "local")
            .map((r) => (
              <div key={r.id}>
                <strong>{r.title}</strong>
                <small>
                  {stationTime(r.hour)} ·{" "}
                  {r.sync === "queued" ? "Awaiting receipt" : "Acknowledged"}
                </small>
              </div>
            ))}
          {!state.records.some((r) => r.sync !== "local") && (
            <p>No queued records. Actions performed during the modeled outage enter the outbox.</p>
          )}
        </div>
      </details>
      <p className="studio-footnote">
        Modeled external link and receiver. The local browser model remains usable; this is not a
        real network-disconnection test or a FastAPI/PostgreSQL health check.
      </p>
    </aside>
  );
}
