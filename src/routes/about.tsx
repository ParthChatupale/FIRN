import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, SectionTitle } from "@/components/firn/shell";
import { useFirn } from "@/lib/firn-context";
import { useOperatingWorkspace } from "@/lib/use-operating-workspace";
import { formatRecordTime } from "@/lib/workspace-model";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About & Case Details — FIRN" }] }),
  component: About,
});
function About() {
  const { preferences } = useFirn();
  const { run, plan, activePlan, activeError, activeLoading, session, cursor, error, loading } =
    useOperatingWorkspace();
  return (
    <>
      <PageHeader
        eyebrow="FIRN / Methodology"
        title="About this workspace"
        description="Data provenance, operating boundaries and reproducible case details."
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="panel p-6">
          <SectionTitle>Station model</SectionTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            FIRN is an operator-reviewed mission-and-energy decision-support prototype. This
            environment uses synthetic station inputs and stored simulation results. No physical
            station equipment or live sensor feed is connected.
          </p>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Forecast scenarios are assumptions, not calibrated probabilities. Modeled feasibility
            and constraint evidence do not certify real-world safety. The operator explicitly
            reviews, approves and activates plans.
          </p>
        </section>
        <section className="panel p-6">
          <SectionTitle>Time & execution</SectionTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            Prepared snapshot H0 is the first saved hourly model record, not a live observation.
            Monitoring reveals saved records through its clock. Charts that show the full saved
            horizon are labeled separately from the current snapshot.
          </p>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Monitoring replay does not execute optimized dispatch. Activating a checkpoint
            replacement ends original-run playback; continuation is not implemented. Local
            API/database health does not establish external connectivity.
          </p>
        </section>
        <section className="panel p-6 xl:col-span-2">
          <SectionTitle>Selected case & evidence</SectionTitle>
          {loading ? (
            <p role="status">Loading case details…</p>
          ) : error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : !run ? (
            <Link to="/scenario-simulator" className="text-primary">
              Create or resume an operating case
            </Link>
          ) : (
            <dl className="grid gap-4 text-sm md:grid-cols-2">
              {[
                ["Station", run.station_name],
                ["Run ID", run.id],
                ["Scenario / seed", `${run.scenario} / ${run.seed}`],
                ["Simulator", run.simulator_version],
                [
                  "Operating cursor",
                  `${cursor.label} · ${formatRecordTime(cursor.point?.timestamp, preferences.timezone)}`,
                ],
                [
                  "Run recorded (wall clock)",
                  formatRecordTime(run.created_at, preferences.timezone),
                ],
                [
                  "Selected proposal",
                  plan ? `v${plan.version_number} · ${plan.status} · ${plan.id}` : "None selected",
                ],
                [
                  "Station active plan",
                  activeLoading
                    ? "Checking…"
                    : activeError
                      ? "Unavailable"
                      : activePlan
                        ? `v${activePlan.version_number} · ${activePlan.id}${activePlan.source_simulation_run_id !== run.id ? " · another operating case" : ""}`
                        : "None",
                ],
                [
                  "Monitoring",
                  session
                    ? `${session.id} · ${session.status} · H${session.current_hour}`
                    : "Not started",
                ],
                [
                  "Planner / solver",
                  plan
                    ? `${plan.planner_model_version} · ${plan.solver_name} ${plan.solver_version}`
                    : "No proposal selected",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
        <section className="panel p-6 xl:col-span-2">
          <SectionTitle>Identity & integration boundaries</SectionTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            Operator profiles are local presentation identities, not verified login credentials or
            authorization. PostgreSQL stores operational records locally. Remote synchronization,
            live hardware adapters and production authentication are not implemented in this
            checkpoint.
          </p>
          <Link
            to="/settings"
            className="mt-4 inline-flex min-h-11 items-center text-sm text-primary"
          >
            Open Settings & local diagnostics →
          </Link>
        </section>
      </div>
    </>
  );
}
