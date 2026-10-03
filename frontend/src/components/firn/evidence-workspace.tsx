import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./shell";
import { useOperatingWorkspace } from "@/lib/use-operating-workspace";
import { useFirn } from "@/lib/firn-context";
import { formatUtc, humanize, number } from "@/lib/display";

// Phase 1 navigation previews show persisted evidence only, not unfinished lifecycle controls.
export function EvidenceWorkspace({ kind }: { kind: "plan" | "monitor" | "lab" | "records" }) {
  const workspace = useOperatingWorkspace();
  const { setCaseLibraryOpen } = useFirn();
  const [filter, setFilter] = useState("");
  const { run, selectedPlan, snapshot: s, session } = workspace;
  const plan = s.referencePlan;
  const title = {
    plan: "Plan",
    monitor: "Monitor",
    lab: "Scenario Lab",
    records: "Decision Record",
  }[kind];
  return (
    <div className="evidence-workspace">
      <div className="ops-title-row">
        <div>
          <div className="micro-label">Persisted evidence / read-only preview</div>
          <h1>{title}</h1>
        </div>
        <Button variant="outline" onClick={() => setCaseLibraryOpen(true)}>
          <FolderOpen size={15} /> Open case
        </Button>
      </div>
      <p className="stage-note">
        {kind === "plan" || kind === "monitor"
          ? "Lifecycle and execution controls will be added in UI Phase 2."
          : "Case creation, comparisons and the complete decision timeline will be added in UI Phase 3."}{" "}
        Operations is the completed Phase 1 workspace.
      </p>
      {workspace.loading ? (
        <p role="status">Loading evidence…</p>
      ) : workspace.error ? (
        <p role="alert" className="inline-error">
          {workspace.error}
        </p>
      ) : !run ? (
        <p className="ops-empty">Open a saved case to inspect its evidence.</p>
      ) : (
        <section className="ops-panel evidence-panel">
          {kind === "lab" && (
            <>
              <h2>
                {humanize(run.scenario)} · {run.duration_days} days
              </h2>
              <p>
                {run.station_name} · {run.config_snapshot.station.missions.length} configured
                missions
              </p>
              <dl className="case-facts">
                <dt>Initial fuel</dt>
                <dd>{number(run.config_snapshot.station.initial_fuel_liters)} L</dd>
                <dt>Protected battery reserve</dt>
                <dd>{number(run.config_snapshot.station.battery.reserve_kwh)} kWh</dd>
                <dt>Generation capacity</dt>
                <dd>
                  {number(run.config_snapshot.station.solar_capacity_kw)} kW solar ·{" "}
                  {number(run.config_snapshot.station.wind_capacity_kw)} kW wind
                </dd>
                <dt>Evaluation horizon</dt>
                <dd>{run.summary.duration_hours} hourly samples</dd>
              </dl>
              <Button onClick={() => setCaseLibraryOpen(true)}>Browse saved cases</Button>
            </>
          )}
          {kind === "plan" &&
            (plan ? (
              <>
                <div className="ops-panel-heading">
                  <h2>Mission-and-energy proposal · v{plan.version_number}</h2>
                  <StatusBadge tone={plan.status === "active" ? "good" : "neutral"}>
                    {plan.status}
                  </StatusBadge>
                </div>
                {selectedPlan && selectedPlan.id !== plan.id && (
                  <p className="stage-note">
                    The active plan is shown here; a different proposal is selected for review.
                  </p>
                )}
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Mission</th>
                        <th>Decision</th>
                        <th>Start</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(plan.plan_snapshot.schedule ?? []).map((item) => (
                        <tr key={item.mission_id}>
                          <td>
                            {run.config_snapshot.station.missions.find(
                              (mission) => mission.id === item.mission_id,
                            )?.name ?? humanize(item.mission_id)}
                          </td>
                          <td>{item.selected ? "Scheduled" : "Deferred"}</td>
                          <td>
                            {typeof item.start_hour === "number" ? `H${item.start_hour}` : "—"}
                          </td>
                          <td>
                            {typeof item.duration_hours === "number"
                              ? `${item.duration_hours} h`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h3 className="detail-heading">Modeled binding constraints</h3>
                {plan.explanations.binding_constraint_evidence?.length ? (
                  <div className="record-list">
                    {plan.explanations.binding_constraint_evidence.map((item, index) => (
                      <article key={index}>
                        <strong>{humanize(item.constraint)}</strong>
                        <p>{item.explanation}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="ops-empty">No binding-constraint evidence was returned.</p>
                )}
                <p className="stage-note">
                  Constraint evidence shows modeled limits reached; it is not a safety
                  certification.
                </p>
              </>
            ) : (
              <p className="ops-empty">
                No plan selected. Open a case with a saved proposal to inspect its schedule.
              </p>
            ))}
          {kind === "monitor" && (
            <>
              <div className="ops-panel-heading">
                <h2>{session ? `Session snapshot · H${s.hour}` : `Case review · H${s.hour}`}</h2>
                <StatusBadge>{session?.status ?? "No session selected"}</StatusBadge>
              </div>
              <dl className="case-facts">
                <dt>Observed time</dt>
                <dd>{formatUtc(s.timestamp)}</dd>
                <dt>Critical service</dt>
                <dd>
                  {s.critical === null
                    ? "Unavailable"
                    : s.critical
                      ? "Shortfall"
                      : "Served at this hour"}
                </dd>
                <dt>Battery</dt>
                <dd>{s.batteryKwh === null ? "Unavailable" : `${number(s.batteryKwh)} kWh`}</dd>
                <dt>Fuel</dt>
                <dd>{s.fuel === null ? "Unavailable" : `${number(s.fuel)} L`}</dd>
                <dt>Plan reference</dt>
                <dd>
                  {workspace.monitoredPlan
                    ? `v${workspace.monitoredPlan.version_number} · ${workspace.monitoredPlan.status}`
                    : "No monitored plan"}
                </dd>
              </dl>
              <p className="stage-note">
                This view does not advance or start a session. Use Operations to review saved case
                hours.
              </p>
            </>
          )}
          {kind === "records" && (
            <>
              <h2>Selected plan history</h2>
              <label className="record-filter">
                Filter saved actions
                <input
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Action, operator or note"
                />
              </label>
              {selectedPlan?.history.length ? (
                <div className="record-list">
                  {[...selectedPlan.history]
                    .filter((item) =>
                      `${item.action} ${item.actor} ${item.note}`
                        .toLowerCase()
                        .includes(filter.toLowerCase()),
                    )
                    .reverse()
                    .map((item, index) => (
                      <article key={index}>
                        <div className="ops-panel-heading">
                          <strong>{humanize(item.action)}</strong>
                          <small>{formatUtc(item.created_at)}</small>
                        </div>
                        <p>
                          {item.from_status ?? "New"} → {item.to_status ?? "Not recorded"} ·{" "}
                          {item.actor ?? "Operator unavailable"}
                        </p>
                        {item.note && <p>{item.note}</p>}
                      </article>
                    ))}
                </div>
              ) : (
                <p className="ops-empty">Select a saved plan to view its recorded actions.</p>
              )}
            </>
          )}
        </section>
      )}
      <Link to="/" className="ops-link">
        <ArrowLeft size={14} /> Return to Operations
      </Link>
    </div>
  );
}
