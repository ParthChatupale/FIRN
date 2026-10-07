import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { usePresentation } from "@/lib/presentation-context";
import { playbackBlock } from "@/lib/recording-workflow";
import { STATION } from "@/lib/presentation-model";
import { buildCaseStudies, workspaceDetails } from "@/lib/workspace-details";
import { format, PageTitle, Panel } from "./presentation-visuals";
import "./workspace-support.css";

export function WorkspaceSupport({ path }: { path: string }) {
  if (path === "/settings") return <WorkspaceSettings />;
  if (path === "/case-studies") return <WorkspaceCaseStudies />;
  return <WorkspaceAbout />;
}

function WorkspaceSettings() {
  const { state, dispatch, storageWarning, scenes } = usePresentation();
  const [notice, setNotice] = useState("");
  const blocked = playbackBlock(state);
  return (
    <div className="workspace-support">
      <PageTitle
        eyebrow="WORKSPACE / CONTROLS"
        title="Settings"
        subtitle="Configure the current browser-local simulation without changing its recorded history."
      />
      <div className="workspace-support-grid">
        <Panel
          title="Simulation playback"
          meta={<span className="studio-chip">Demonstration only</span>}
        >
          <p>Accelerated time is a demonstration control, not the passage of real station time.</p>
          <label className="workspace-support-field">
            Station time per playback second
            <select
              value={state.playback.rate}
              onChange={(e) => {
                dispatch({ type: "set-playback-rate", rate: Number(e.target.value) as 1 | 6 | 30 });
                setNotice("Playback speed updated. The operating clock has not advanced.");
              }}
            >
              {[1, 6, 30].map((rate) => (
                <option value={rate} key={rate}>
                  {rate} station minute{rate === 1 ? "" : "s"} / second
                </option>
              ))}
            </select>
          </label>
          <p>
            Playback pauses at event checkpoints, pending decisions and required planning responses.
          </p>
          <button
            className="studio-button secondary"
            disabled={!state.playback.running && !!blocked}
            onClick={() => dispatch({ type: "toggle-playback" })}
          >
            {state.playback.running ? "Pause simulation" : "Resume simulation"}
          </button>
          <p className="studio-footnote" role="status">
            {blocked ?? state.playback.reason}
          </p>
        </Panel>
        <Panel title="Planning allowance">
          <p>
            New work includes time for operator authorization and mobilization before it can start.
          </p>
          <label className="workspace-support-field">
            Authorization + mobilization allowance
            <select
              value={state.planningLeadMinutes ?? 30}
              disabled={!!state.preparation || !!state.proposal}
              onChange={(e) => {
                dispatch({ type: "set-lead-time", minutes: Number(e.target.value) });
                setNotice(
                  "Allowance updated for future proposals. The active schedule is unchanged.",
                );
              }}
            >
              {[15, 30, 60, 120].map((minutes) => (
                <option value={minutes} key={minutes}>
                  {minutes} station minutes
                </option>
              ))}
            </select>
          </label>
          <p>
            {state.preparation || state.proposal
              ? "Finish or reject the pending proposal before changing this allowance."
              : "Changes apply to future proposal generation, not previously authorized or completed work."}
          </p>
          <p className="studio-footnote">
            Illustrative allowance; not a station-certified operating requirement.
          </p>
        </Panel>
        <Panel title="Local storage & scene checkpoints">
          <span className={`studio-chip ${storageWarning ? "warn" : "good"}`}>
            {storageWarning ? "Storage warning" : "Browser-local workspace"}
          </span>
          <p>
            {storageWarning
              ? "Some browser state could not be read or saved. Do not rely on reload to retain your latest work."
              : "This browser retains the operating case, proposals, decisions and field issue reports. It is not a shared cloud database."}
          </p>
          <p>
            {scenes.length} saved scene checkpoint{scenes.length === 1 ? "" : "s"}. Shift-click the
            header clock to manage paused snapshots.
          </p>
          <p>Restoring a scene replaces the current local case. These settings do not reset it.</p>
        </Panel>
        <Panel title="Operating conventions">
          <dl className="workspace-support-details">
            <div>
              <dt>Station timestamps</dt>
              <dd>UTC · fictional case calendar</dd>
            </div>
            <div>
              <dt>Display units</dt>
              <dd>°C · km/h · kW · kWh · L</dd>
            </div>
            <div>
              <dt>Weather assumptions</dt>
              <dd>Scenario Simulator</dd>
            </div>
            <div>
              <dt>Plan authorization</dt>
              <dd>Mission Planner only</dd>
            </div>
          </dl>
          <p>
            Weather observations and independent generator events are distinct from forecast
            assumptions. No hardware or live sensor feed is connected.
          </p>
          <Link to="/about" className="studio-inline-link">
            About FIRN & model boundaries ↗
          </Link>
        </Panel>
      </div>
      <p className="workspace-support-notice" role="status" aria-live="polite">
        {notice}
      </p>
    </div>
  );
}

function CurrentCase() {
  const { state } = usePresentation();
  const details = workspaceDetails(state);
  return (
    <Panel
      title="Your current operating case"
      meta={<span className="studio-chip">Live workspace state</span>}
    >
      <dl className="workspace-support-details">
        {[
          ["Operating clock", details.timestamp],
          [
            "Active plan",
            `V${details.activeVersion} · ${state.activeKind === "original" ? "Original schedule" : "Joint mission–energy schedule"}`,
          ],
          ["Pending proposal", details.proposal],
          [
            "Modeled mission delivery",
            `${details.completed} / ${details.total} completed · ${details.deferred} deferred`,
          ],
          ["Current battery / fuel", `${format(details.battery)} kWh / ${format(details.fuel)} L`],
          [
            "Generator 01 available",
            `${format(details.generatorCapacity)} / ${STATION.generatorOne} kW`,
          ],
          ["Applied resupply arrival", details.arrival],
          [
            "Weather event",
            details.weatherObserved ? "Modeled observation recorded" : "Not observed",
          ],
          ["Field issue reports", `${details.issueReports} browser-local reports for review`],
          ["Decision & event history", `${details.records} local records`],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="studio-action-row">
        <Link to="/mission-planner" className="studio-inline-link">
          Inspect the plan ↗
        </Link>
        <Link to="/decision-log" className="studio-inline-link">
          Inspect decision history ↗
        </Link>
      </div>
    </Panel>
  );
}

function WorkspaceAbout() {
  return (
    <div className="workspace-support">
      <PageTitle
        eyebrow="FIRN / MISSION-AWARE RESILIENCE"
        title="About FIRN"
        subtitle="Keep essential services supplied while deciding what the station can still deliver."
        action={
          <Link to="/case-studies" className="studio-button secondary">
            Explore case studies ↗
          </Link>
        }
      />
      <div className="workspace-support-grid">
        <Panel title="One plan for missions, teams and energy">
          <p>
            FIRN brings mission timing, shared equipment and personnel, energy dispatch, battery
            reserve and fuel into one operator-reviewed planning workflow.
          </p>
          <p>
            Operations shows the current position. Look ahead exposes future pressure. Mission
            Planner prepares a response that the operator reviews, approves and explicitly
            activates.
          </p>
          <p>
            Original, energy-first and joint alternatives illustrate trade-offs—not a guarantee that
            one approach always uses less fuel or delivers more work.
          </p>
        </Panel>
        <Panel title="A virtual station, not a live deployment">
          <p>
            This demonstration uses a fictional coastal polar station with authored, deterministic
            inputs inspired by real-world operating principles. It is not recorded Antarctic station
            telemetry or a calibrated digital twin.
          </p>
          <p>
            The case begins on 15 January 2026 at 06:00 UTC. Its preceding 48 hours are generated
            operating history ending at the opening inventory—not training data for a learned
            forecast.
          </p>
          <p>
            Physical equipment, sensor adapters, production authentication and real remote
            synchronization are not connected in this workspace.
          </p>
        </Panel>
        <Panel title="Plan ahead, observe, then adapt">
          <p>
            A future weather or resupply assumption updates the outlook without rewriting prior
            observations or automatically replacing the active plan.
          </p>
          <p>
            At a weather checkpoint, the operator records the modeled observation. A generator
            capacity loss is a separate scenario event; a storm does not automatically cause it.
          </p>
          <p>
            Plan activation preserves current inventories and supplied work. Playback integrates
            modeled dispatch and mission-minute progress; it continues under the newly authorized
            schedule.
          </p>
        </Panel>
        <Panel title="Operator attention is not automatic approval">
          <p>
            Notifications separate input receipt, assessment readiness, forecast conditions and
            observed events. Acknowledgement records attention—not resolution, authorization or
            synchronization.
          </p>
          <p>
            Monitoring also lets operators report a mission issue and their field assessment for
            review. Supplied operating time does not certify a successful field outcome.
          </p>
          <p>
            Issue reporting does not automatically stop work, reschedule dependent tasks or validate
            sample quality. Those decisions remain outside the demonstrated implementation.
          </p>
        </Panel>
        <div className="workspace-support-wide">
          <CurrentCase />
        </div>
        <Panel title="Configured station model">
          <dl className="workspace-support-details">
            <div>
              <dt>Essential demand</dt>
              <dd>{STATION.criticalLoad} kW</dd>
            </div>
            <div>
              <dt>Generators</dt>
              <dd>
                {STATION.generatorOne} + {STATION.generatorTwo} kW nameplate
              </dd>
            </div>
            <div>
              <dt>Wind / solar</dt>
              <dd>
                {STATION.windCapacity} / {STATION.solarCapacity} kW nameplate
              </dd>
            </div>
            <div>
              <dt>Battery / protected reserve</dt>
              <dd>
                {STATION.batteryCapacity} / {STATION.batteryReserve} kWh
              </dd>
            </div>
            <div>
              <dt>Opening fuel / protected buffer</dt>
              <dd>
                {format(STATION.initialFuel)} / {STATION.protectedFuel} L
              </dd>
            </div>
            <div>
              <dt>Opening battery</dt>
              <dd>{STATION.initialBattery} kWh</dd>
            </div>
          </dl>
        </Panel>
        <Panel title="What the results establish—and what they do not">
          <p>
            Proposals use a bounded, priority-first schedule search and deterministic dispatch
            checks. This browser-local model does not call the separate backend optimizer and is not
            an AI reasoning engine or proof of optimality.
          </p>
          <p>
            Adverse bands compare configured parameter sets; they are not statistical confidence
            intervals. Feasibility depends on authored weather, capacity, fuel and mission
            assumptions.
          </p>
          <p>
            Equipment start-up dynamics, detailed polar solar geometry, field-task dependencies and
            engineering safety certification are not modeled. A feasible result is not real-station
            authorization.
          </p>
          <Link to="/settings" className="studio-inline-link">
            Workspace settings ↗
          </Link>
        </Panel>
      </div>
    </div>
  );
}

export function WorkspaceCaseStudies() {
  const studies = useMemo(() => buildCaseStudies(), []);
  return (
    <div className="workspace-support">
      <PageTitle
        eyebrow="FIRN / ILLUSTRATIVE OPERATING CASES"
        title="Case studies"
        subtitle="Reproducible examples calculated with the current station model—not field deployments."
        action={
          <Link to="/about" className="studio-button secondary">
            Model & boundaries ↗
          </Link>
        }
      />
      <div className="studio-note">
        <strong>Examples are separate from your operating case</strong>
        <p>
          These read-only studies use fresh, isolated model states. Viewing them does not apply
          inputs, activate a plan, advance your clock or replace your saved workspace. Results are
          conditional on the example configuration.
        </p>
      </div>
      <div className="workspace-support-grid">
        {studies.map((study) => (
          <Panel
            title={study.title}
            key={study.id}
            meta={
              <span className={`studio-chip ${study.feasible ? "good" : "warn"}`}>
                {study.stage === "execution"
                  ? "Modeled execution"
                  : study.stage === "no-go"
                    ? "Not feasible"
                    : "Planning projection"}
              </span>
            }
          >
            <h3 className="workspace-support-question">{study.question}</h3>
            <p>{study.detail}</p>
            <dl className="workspace-support-details">
              <div>
                <dt>Example checkpoint</dt>
                <dd>{study.timestamp}</dd>
              </div>
              <div>
                <dt>Generator 01 available</dt>
                <dd>{study.generatorCapacity} kW</dd>
              </div>
              {study.stage === "no-go" ? (
                <div>
                  <dt>Operator decision</dt>
                  <dd>Approval blocked · no replacement activated</dd>
                </div>
              ) : (
                <>
                  <div>
                    <dt>
                      {study.stage === "execution"
                        ? "Modeled missions completed"
                        : "Missions scheduled"}
                    </dt>
                    <dd>{study.stage === "execution" ? study.completed : study.scheduled} / 6</dd>
                  </div>
                  <div>
                    <dt>Deferred work</dt>
                    <dd>{study.deferred.join(", ") || "None"}</dd>
                  </div>
                  <div>
                    <dt>Nominal fuel before resupply</dt>
                    <dd>{format(study.fuelAtResupply)} L</dd>
                  </div>
                  <div>
                    <dt>Adverse battery margin above reserve</dt>
                    <dd>{format(study.reserveMargin, 1)} kWh</dd>
                  </div>
                </>
              )}
            </dl>
            {study.stage === "no-go" && (
              <ul>
                {study.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
            {study.stage === "execution" && (
              <p className="studio-footnote">
                Completion means modeled supplied work, not verified field success. Reserve and fuel
                metrics describe the remaining projection from this checkpoint.
              </p>
            )}
          </Panel>
        ))}
        <div className="workspace-support-wide">
          <CurrentCase />
        </div>
      </div>
    </div>
  );
}
