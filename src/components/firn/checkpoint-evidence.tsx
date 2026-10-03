import type { PlanVersion, PlanScheduleItem } from "@/lib/firn-api";
import { numberLabel } from "@/lib/operations-metrics";

export function CheckpointEvidence({ plan }: { plan: PlanVersion }) {
  const checkpoint = plan.plan_snapshot["monitoring_replan"] as
    | {
        checkpoint_hour: number;
        absolute_origin_hour: number;
        remaining_hours: number;
        trigger: string;
        baseline_status: string;
        baseline_schedule: PlanScheduleItem[];
        starting_state: { battery_kwh: number; fuel_liters: number };
        benefit_assessment: Record<string, number | boolean>;
      }
    | undefined;
  if (!checkpoint) return <p className="text-xs">Checkpoint comparison unavailable.</p>;
  const origin = checkpoint.absolute_origin_hour;
  const benefits = checkpoint.benefit_assessment;
  const baseline = new Map((checkpoint.baseline_schedule ?? []).map((p) => [p.mission_id, p]));
  const candidate = plan.plan_snapshot.schedule ?? [];
  return (
    <section className="mt-4 space-y-3 text-xs" aria-label="Replacement consequences">
      <p className="font-semibold text-warning">
        Trigger: {checkpoint.trigger.replaceAll("_", " ")} · H{checkpoint.checkpoint_hour}
      </p>
      <p className="text-muted-foreground">
        Same remaining horizon: H{origin}–H{origin + checkpoint.remaining_hours - 1} ·{" "}
        {checkpoint.remaining_hours} hours
      </p>
      <div className="grid grid-cols-2 gap-2 rounded border border-border p-3">
        <p>
          Opening battery
          <br />
          <strong>{numberLabel(checkpoint.starting_state.battery_kwh)} kWh</strong>
        </p>
        <p>
          Opening fuel
          <br />
          <strong>{numberLabel(checkpoint.starting_state.fuel_liters)} L</strong>
        </p>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Remaining mission decisions</h3>
        {!candidate.length && <p className="text-muted-foreground">No remaining scheduled work.</p>}
        {candidate.map((p) => {
          const old = baseline.get(p.mission_id);
          return (
            <p key={p.mission_id} className="border-t border-border pt-2">
              <strong>{p.mission_id.replaceAll("-", " ")}</strong>
              <br />
              {p.selected
                ? `H${origin + Number(p.start_hour)} · ${p.duration_hours} h`
                : `Not scheduled: ${p.reason ?? "not selected"}`}
              {old?.selected && p.selected && old.start_hour !== p.start_hour
                ? ` · carry-forward H${origin + Number(old.start_hour)}`
                : ""}
            </p>
          );
        })}
      </div>
      <details className="rounded border border-border p-3">
        <summary className="cursor-pointer text-primary">
          Matched-horizon comparison & assumptions
        </summary>
        <p className="mt-2">
          Carry-forward: {checkpoint.baseline_status}. Candidate:{" "}
          {plan.plan_snapshot["status"] as string}.
        </p>
        {checkpoint.baseline_status === "infeasible" ? (
          <p className="mt-2">
            Carry-forward is infeasible; no fuel-saving percentage is reported.
          </p>
        ) : (
          <>
            <p className="mt-2">
              Modeled fuel: {numberLabel(benefits["carry_forward_modeled_fuel_liters"])} →{" "}
              {numberLabel(benefits["candidate_modeled_fuel_liters"])} L.
            </p>
            <p className="mt-2">
              Priority score: {numberLabel(benefits["carry_forward_priority_score"])} →{" "}
              {numberLabel(benefits["candidate_priority_score"])}.
            </p>
          </>
        )}
        <p className="mt-2">
          These are optimizer results on the same remaining state/horizon, not measured savings or a
          comparison against the full original run. Completed work is not repeated. Weather remains
          a declared model trajectory; approval does not guarantee physical safety.
        </p>
      </details>
    </section>
  );
}
