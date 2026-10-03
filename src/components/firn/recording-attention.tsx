import { Link } from "@tanstack/react-router";
import { Bell, Check, LoaderCircle, ArrowUpRight, X } from "lucide-react";
import { useState } from "react";
import { usePresentation } from "@/lib/presentation-context";
import { stationTime } from "@/lib/presentation-model";
import { attentionItems, type Attention } from "@/lib/recording-workflow";

export function PreparationStatus() {
  const { state, dispatch } = usePresentation();
  if (!state.preparation)
    return state.failedPreparation ? (
      <div className="recording-preparation" role="status">
        Preparation interrupted; active plan retained.
        <button
          className="studio-button secondary"
          onClick={() => dispatch({ type: "retry-task" })}
        >
          Retry preparation
        </button>
      </div>
    ) : null;
  const names = {
    plan: "Preparing joint proposal",
    forecast: "Refreshing operating outlook",
    assessment: "Assessing active plan after capacity loss",
  };
  return (
    <div className="recording-preparation" role="status" aria-live="polite">
      <LoaderCircle size={17} className="recording-spinner" />
      <div>
        <strong>{names[state.preparation.kind]}</strong>
        <small>
          Active V{state.activeVersion} retained · operating clock H{state.hour}
        </small>
      </div>
    </div>
  );
}
export function AttentionQueue({
  scope,
  history = false,
  compact = false,
  onConnectivity,
}: {
  scope?: Attention["scope"];
  history?: boolean;
  compact?: boolean;
  onConnectivity?: () => void;
}) {
  const { state, dispatch } = usePresentation();
  const items = attentionItems(state, scope, history);
  return (
    <div className={`recording-attention-list ${compact ? "compact" : ""}`}>
      {!items.length && (
        <p className="recording-attention-empty">
          No outstanding {scope ? `${scope} ` : ""}attention items.
        </p>
      )}
      {items.slice(0, compact ? 2 : 60).map((n) => (
        <article
          className={`recording-attention-item priority-${n.priority} ${!n.active ? "resolved" : ""}`}
          key={n.id}
        >
          <div className="recording-attention-meta">
            <span>{n.priority}</span>
            <time>{stationTime(n.hour + (n.minute ?? 0) / 60)}</time>
            <span>
              {n.condition ? (n.active ? "Active" : "Resolved") : "Event"} ·{" "}
              {n.acknowledged ? "Seen" : "New"}
            </span>
          </div>
          <strong>{n.title}</strong>
          <p>{n.detail}</p>
          <div className="recording-attention-actions">
            {n.scope === "connection" && onConnectivity ? (
              <button className="studio-inline-link" onClick={onConnectivity}>
                Open connectivity <ArrowUpRight size={12} />
              </button>
            ) : (
              <Link to={n.route} className="studio-inline-link">
                {n.scope === "connection" ? "Inspect station context" : n.action}
                <ArrowUpRight size={12} />
              </Link>
            )}
            {!n.acknowledged && (
              <button
                aria-label={`Acknowledge ${n.title}`}
                className="studio-button quiet"
                onClick={() => dispatch({ type: "ack-attention", id: n.id })}
              >
                <Check size={12} />
                Acknowledge
              </button>
            )}
          </div>
        </article>
      ))}
      {compact && items.length > 2 && (
        <small>{items.length - 2} more in header notifications</small>
      )}
    </div>
  );
}
export function NotificationButton({ onConnectivity }: { onConnectivity: () => void }) {
  const { state } = usePresentation();
  const [open, setOpen] = useState(false),
    [history, setHistory] = useState(false);
  const count = attentionItems(state).filter((n) => !n.acknowledged).length;
  return (
    <div className="recording-notification-control">
      <button
        className="studio-icon-button recording-bell"
        aria-label={`Notifications, ${count} unacknowledged`}
        aria-expanded={open}
        aria-controls="recording-notifications"
        onClick={() => setOpen(!open)}
      >
        <Bell size={19} />
        {count > 0 && <span>{count}</span>}
      </button>
      {open && (
        <section
          id="recording-notifications"
          className="recording-notifications"
          aria-label="Station notifications"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <header>
            <strong>Station attention</strong>
            <button
              className="studio-icon-button"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </header>
          <div className="studio-segmented">
            <button className={!history ? "selected" : ""} onClick={() => setHistory(false)}>
              Outstanding
            </button>
            <button className={history ? "selected" : ""} onClick={() => setHistory(true)}>
              History
            </button>
          </div>
          <PreparationStatus />
          <AttentionQueue
            history={history}
            onConnectivity={() => {
              setOpen(false);
              onConnectivity();
            }}
          />
          <small className="studio-footnote">
            Acknowledgement records attention, not resolution or authorization.
          </small>
        </section>
      )}
    </div>
  );
}
export function DecisionLink() {
  const { state } = usePresentation();
  return (
    <div className="recording-decision-link">
      <span className="studio-chip">ACTIVE V{state.activeVersion}</span>
      <strong>
        {state.preparation?.kind === "plan"
          ? "Proposal preparing"
          : state.proposal
            ? `V${state.proposal.version} awaits operator decision`
            : state.responseRequired
              ? "Planning response required"
              : "Active schedule retained"}
      </strong>
      <Link to="/mission-planner" className="studio-inline-link">
        {state.proposal ? "Open revision in Mission Planner" : "Open Mission Planner"}
        <ArrowUpRight size={14} />
      </Link>
    </div>
  );
}
