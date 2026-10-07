/** Operator field assessments are reporting metadata, never simulated work credits. */
import {
  currentStation,
  missionServedMinutes,
  stationHour,
  type PresentationState,
} from "./recording-engine.ts";

export const FIELD_ASSESSMENTS = {
  review: "Needs review / not yet known",
  sufficient: "Work sufficient — operator assessment",
  additional: "Additional work needed",
  unable: "Unable to continue",
} as const;
export type FieldAssessment = keyof typeof FIELD_ASSESSMENTS;
export type MissionIssueReport = {
  id: string;
  missionId: string;
  missionName: string;
  hour: number;
  minute: number;
  planVersion: number;
  suppliedMinutes: number;
  assessment: FieldAssessment;
  detail: string;
  status: "needs-review";
};
export const MAX_MISSION_REPORTS = 100;

export function canReportMission(s: PresentationState, missionId: string): boolean {
  return (
    s.activeSchedule.some((m) => m.id === missionId) &&
    (missionServedMinutes(s, missionId) > 0 ||
      currentStation(s).runningMissions.includes(missionId))
  );
}

export function createMissionIssueReport(
  s: PresentationState,
  reports: MissionIssueReport[],
  missionId: string,
  assessment: FieldAssessment,
  detail: string,
): MissionIssueReport | null {
  if (
    reports.length >= MAX_MISSION_REPORTS ||
    !canReportMission(s, missionId) ||
    typeof assessment !== "string" ||
    !Object.hasOwn(FIELD_ASSESSMENTS, assessment) ||
    typeof detail !== "string" ||
    detail.trim().length < 5 ||
    detail.trim().length > 1000
  )
    return null;
  const mission = s.activeSchedule.find((m) => m.id === missionId)!;
  return {
    id: `mission-report-${s.hour}-${s.minute ?? 0}-${reports.length + 1}`,
    missionId,
    missionName: mission.short,
    hour: s.hour,
    minute: s.minute ?? 0,
    planVersion: s.activeVersion,
    suppliedMinutes: missionServedMinutes(s, missionId),
    assessment,
    detail: detail.trim(),
    status: "needs-review",
  };
}

export function restoreMissionIssueReports(
  raw: unknown,
  s: PresentationState,
): MissionIssueReport[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  return raw.slice(0, MAX_MISSION_REPORTS).filter((r): r is MissionIssueReport => {
    if (
      !r ||
      typeof r.id !== "string" ||
      !r.id.startsWith("mission-report-") ||
      ids.has(r.id) ||
      !s.activeSchedule.some((m) => m.id === r.missionId && m.short === r.missionName) ||
      !Number.isInteger(r.hour) ||
      r.hour < 0 ||
      !Number.isInteger(r.minute) ||
      r.minute < 0 ||
      r.minute > 59 ||
      r.hour + r.minute / 60 > stationHour(s) ||
      !Number.isInteger(r.planVersion) ||
      r.planVersion < 1 ||
      r.planVersion > s.activeVersion ||
      !Number.isFinite(r.suppliedMinutes) ||
      r.suppliedMinutes < 0 ||
      r.suppliedMinutes > missionServedMinutes(s, r.missionId) ||
      typeof r.assessment !== "string" ||
      !Object.hasOwn(FIELD_ASSESSMENTS, r.assessment) ||
      typeof r.detail !== "string" ||
      r.detail.trim().length < 5 ||
      r.detail.length > 1000 ||
      r.status !== "needs-review"
    )
      return false;
    ids.add(r.id);
    return true;
  });
}
