import { createRootRoute, createRoute, createRouter, Link, Outlet } from "@tanstack/react-router";
import { Shell } from "@/components/firn/shell";
import { OperationsCenter } from "@/components/firn/operations-center";
import { EvidenceWorkspace } from "@/components/firn/evidence-workspace";

const root = createRootRoute({
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
  notFoundComponent: () => (
    <section className="ops-panel ops-setup">
      <h1>Workspace not found</h1>
      <Link to="/">Return to Operations</Link>
    </section>
  ),
  errorComponent: ({ error, reset }) => (
    <section role="alert" className="ops-panel ops-setup">
      <h1>Workspace unavailable</h1>
      <p>{error.message}</p>
      <button className="text-button" onClick={reset}>
        Retry
      </button>
    </section>
  ),
});
const operations = createRoute({
  getParentRoute: () => root,
  path: "/",
  component: OperationsCenter,
});
const plan = createRoute({
  getParentRoute: () => root,
  path: "/plan",
  component: () => <EvidenceWorkspace kind="plan" />,
});
const monitor = createRoute({
  getParentRoute: () => root,
  path: "/monitor",
  component: () => <EvidenceWorkspace kind="monitor" />,
});
const lab = createRoute({
  getParentRoute: () => root,
  path: "/scenario-lab",
  component: () => <EvidenceWorkspace kind="lab" />,
});
const records = createRoute({
  getParentRoute: () => root,
  path: "/decision-record",
  component: () => <EvidenceWorkspace kind="records" />,
});
export const router = createRouter({
  routeTree: root.addChildren([operations, plan, monitor, lab, records]),
  defaultPreload: "intent",
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
