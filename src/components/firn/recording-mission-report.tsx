import { useId, useState } from "react";
import { usePresentation } from "@/lib/presentation-context";
import {
  FIELD_ASSESSMENTS,
  MAX_MISSION_REPORTS,
  canReportMission,
  type FieldAssessment,
} from "@/lib/recording-mission-reports";
import { stationTime } from "@/lib/presentation-model";
import { Panel, format } from "./presentation-visuals";
import "./recording-mission-report.css";

export function MissionIssueReporting() {
  const { state, dispatch, storageWarning } = usePresentation();
  const [open, setOpen] = useState(false);
  const [missionId, setMissionId] = useState("");
  const [assessment, setAssessment] = useState<FieldAssessment>("review");
  const [detail, setDetail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const formId = useId();
  const reports = state.missionIssueReports ?? [];
  const eligible = canReportMission(state, missionId);
  const full = reports.length >= MAX_MISSION_REPORTS;
  const canSave = eligible && detail.trim().length >= 5 && !full;
  return (
    <Panel
      title="Field outcome reporting"
      className="monitor-mission-report"
      meta={
        <button
          type="button"
          className="studio-button secondary"
          aria-expanded={open}
          aria-controls={formId}
          onClick={() => {
            setOpen(!open);
            setSubmitted(false);
          }}
        >
          {open ? "Close report" : "Report mission issue"}
        </button>
      }
    >
      <p className="monitor-report-summary">
        Operating-time progress is not confirmation of a successful field outcome. Operators can
        record issues and their assessment for review.
      </p>
      {open && (
        <form
          id={formId}
          className="monitor-report-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSave) return;
            dispatch({ type: "report-mission-issue", missionId, assessment, detail });
            setDetail("");
            setAssessment("review");
            setOpen(false);
            setSubmitted(true);
          }}
        >
          <div className="monitor-report-fields">
            <label>
              Mission
              <select required value={missionId} onChange={(e) => setMissionId(e.target.value)}>
                <option value="">Select a mission…</option>
                {state.activeSchedule.map((mission) => (
                  <option key={mission.id} value={mission.id}>
                    {mission.short}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Operator assessment
              <select
                value={assessment}
                onChange={(e) => setAssessment(e.target.value as FieldAssessment)}
              >
                {Object.entries(FIELD_ASSESSMENTS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Issue / field outcome
            <textarea
              required
              minLength={5}
              maxLength={1000}
              rows={3}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Describe what happened and whether the collected work may be sufficient."
            />
          </label>
          <p className="monitor-report-note">
            Reporting only: saving requests operator review. It does not stop execution, certify
            sample quality, alter completion credits, or automatically reschedule dependent work.
          </p>
          <div className="monitor-report-actions">
            <button className="studio-button" type="submit" disabled={!canSave}>
              Save for review
            </button>
            <span>
              {full
                ? "Report limit reached for this case."
                : missionId && !eligible
                  ? "Reporting becomes available when this mission starts."
                  : "Saved with station time, active plan, and supplied operating minutes."}
            </span>
          </div>
        </form>
      )}
      <div role="status" aria-live="polite" className="monitor-report-note">
        {submitted &&
          (storageWarning
            ? "Report added to this session; browser storage is unavailable."
            : "Report saved locally for operator review. Operating schedule unchanged.")}
      </div>
      {reports.length > 0 && (
        <details className="monitor-report-history">
          <summary>Field reports · {reports.length} awaiting review</summary>
          {[...reports].reverse().map((report) => (
            <article key={report.id}>
              <div className="monitor-report-record-heading">
                <strong>{report.missionName}</strong>
                <span className="studio-chip warn">OUTCOME NEEDS REVIEW</span>
              </div>
              <small>
                {stationTime(report.hour + report.minute / 60)} · V{report.planVersion} ·{" "}
                {format(report.suppliedMinutes, 1)} supplied minutes
              </small>
              <p>{report.detail}</p>
              <small>Operator assessment: {FIELD_ASSESSMENTS[report.assessment]}</small>
            </article>
          ))}
        </details>
      )}
    </Panel>
  );
}
