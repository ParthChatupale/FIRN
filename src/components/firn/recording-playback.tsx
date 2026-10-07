import { useState } from "react";
import { Play, Pause, X } from "lucide-react";
import { usePresentation } from "@/lib/presentation-context";
import {
  currentStation,
  missionProgress,
  missionServedMinutes,
  stationHour,
  stationTime,
} from "@/lib/presentation-model";
import { playbackBlock } from "@/lib/recording-workflow";

export function StationClock({ openControls }: { openControls: () => void }) {
  const { state, dispatch } = usePresentation();
  const block = playbackBlock(state);
  return (
    <button
      className="studio-clock recording-clock-button"
      aria-label={`${state.playback.running ? "Pause" : "Resume"} station clock. ${block ?? state.playback.reason}`}
      aria-pressed={state.playback.running}
      title={`${block ?? state.playback.reason}. Click to play/pause; Shift-click for simulation controls.`}
      onClick={(e) => (e.shiftKey ? openControls() : dispatch({ type: "toggle-playback" }))}
    >
      <strong>{stationTime(stationHour(state))}</strong>
      <small>
        {state.playback.running ? <Play size={10} /> : <Pause size={10} />} H{state.hour}:
        {String(state.minute ?? 0).padStart(2, "0")} ·{" "}
        {state.playback.running ? "Running" : "Paused"}
      </small>
    </button>
  );
}
export function RehearsalControls({ close }: { close: () => void }) {
  const { state, dispatch, scenes, saveScene, restoreScene, removeScene } = usePresentation();
  const [name, setName] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  return (
    <section
      className="recording-rehearsal-panel"
      role="dialog"
      aria-label="Simulation controls and saved snapshots"
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <header>
        <strong>Simulation Controls</strong>
        <button
          className="studio-icon-button"
          aria-label="Close simulation controls"
          onClick={close}
        >
          <X size={18} />
        </button>
      </header>
      <p>
        {stationTime(stationHour(state))} · {state.playback.reason}
      </p>
      <p className="studio-footnote">
        Control simulated time and save workspace snapshots. Restoring a snapshot replaces the
        browser-local case, including its decisions; backend records are unaffected.
      </p>
      <label>
        Playback speed
        <select
          value={state.playback.rate}
          onChange={(e) =>
            dispatch({ type: "set-playback-rate", rate: Number(e.target.value) as 1 | 6 | 30 })
          }
        >
          <option value="1">1 station minute / second</option>
          <option value="6">6 station minutes / second</option>
          <option value="30">30 station minutes / second</option>
        </select>
      </label>
      <label>
        Authorization + mobilization allowance
        <select
          value={state.planningLeadMinutes ?? 30}
          disabled={!!state.proposal || !!state.preparation}
          onChange={(e) => dispatch({ type: "set-lead-time", minutes: Number(e.target.value) })}
        >
          {[15, 30, 60, 120].map((m) => (
            <option key={m} value={m}>
              {m} station minutes
            </option>
          ))}
        </select>
      </label>
      <div className="studio-action-row">
        <button
          className="studio-button secondary"
          disabled={!!playbackBlock(state) && !state.playback.running}
          onClick={() => dispatch({ type: "toggle-playback" })}
        >
          {state.playback.running ? "Pause" : "Resume execution"}
        </button>
        <button
          className="studio-button quiet"
          disabled={!!playbackBlock(state)}
          onClick={() => dispatch({ type: "advance-minutes", minutes: 1 })}
        >
          +1 minute
        </button>
      </div>
      <label>
        Save workspace snapshot
        <input
          value={name}
          maxLength={80}
          placeholder="Snapshot name"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        className="studio-button secondary"
        disabled={!name.trim() || !!state.preparation || !!state.failedPreparation}
        onClick={() => {
          saveScene(name);
          setName("");
        }}
      >
        Save paused snapshot
      </button>
      <div className="recording-scene-list">
        {scenes.map((scene) => (
          <div key={scene.id}>
            <strong>{scene.name}</strong>
            <small>
              {stationTime(stationHour(scene.snapshot))} · active V{scene.snapshot.activeVersion}
            </small>
            <div className="studio-action-row">
              <button className="studio-button secondary" onClick={() => setPending(scene.id)}>
                Restore
              </button>
              <button className="studio-button quiet" onClick={() => removeScene(scene.id)}>
                Remove snapshot
              </button>
            </div>
          </div>
        ))}
      </div>
      {pending && (
        <div className="recording-restore-confirm" role="alert">
          <strong>Restore this workspace snapshot?</strong>
          <p>
            Current browser-local changes since this snapshot will be replaced. Save a new snapshot
            first if you want to keep them.
          </p>
          <button
            className="studio-button"
            onClick={() => {
              restoreScene(pending);
              setPending(null);
              close();
            }}
          >
            Restore snapshot
          </button>
          <button className="studio-button quiet" onClick={() => setPending(null)}>
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}
export function MissionActivity() {
  const { state } = usePresentation();
  const c = currentStation(state);
  const running = state.activeSchedule.filter(
    (m) =>
      !m.deferred && c.runningMissions.includes(m.id) && missionProgress(state, m) !== "Completed",
  );
  const next = [...state.activeSchedule]
    .filter(
      (m) =>
        !m.deferred && m.start > stationHour(state) && missionProgress(state, m) !== "Completed",
    )
    .sort((a, b) => a.start - b.start)[0];
  const recent = state.records.filter((r) => r.type === "mission-completed").at(-1);
  return (
    <section className="recording-mission-activity" aria-label="Mission activity">
      <header>
        <strong>Mission activity</strong>
        <span>{running.length ? `${running.length} running` : "Between missions"}</span>
      </header>
      {!running.length && <p>No mission currently running</p>}
      {running.map((m) => {
        const required = state.activations[0]!.schedule.find((x) => x.id === m.id)!.duration * 60;
        const served = missionServedMinutes(state, m.id);
        return (
          <div key={m.id}>
            <strong>{m.short}</strong>
            <small>
              {m.resource} · {m.power} kW · {Math.max(0, required - served)} supplied minutes
              remaining
            </small>
            <progress
              max={required}
              value={served}
              aria-label={`${m.short} supplied work progress`}
            />
            <span>
              {served}/{required} supplied minutes
            </span>
          </div>
        );
      })}
      {next && (
        <p>
          <strong>Next:</strong> {next.short} · {stationTime(next.start)}
        </p>
      )}
      {recent && (
        <p>
          <strong>Completed:</strong> {recent.title.replace(/ completed$/, "")} ·{" "}
          {stationTime(recent.hour + (recent.minute ?? 0) / 60)}
        </p>
      )}
    </section>
  );
}
