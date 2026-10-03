# FIRN — New operator frontend

This directory is the separate workspace for the redesigned frontend. The existing application remains in the repository's root `src/` directory, with its existing launch commands and backend integration.

## Current status

The initial Operations design, shared operating-data loader, API client, and shell have been preserved here from the in-place redesign. This is **an unfinished source draft, not a runnable or accepted frontend release**. Its standalone application entry point, configuration, dependencies, styling, and remaining screens have not been completed. Do not treat the presence of this folder as completion of UI Phase 1.

The draft API client uses the existing FastAPI endpoints. The new frontend will share the existing backend and PostgreSQL database; it does not require a new database, copied backend, or additional migrations. The original application must remain usable throughout the rebuild.

## Product and demonstration requirements

Use the [demonstration contract](../docs/firn-demonstration-contract.md) as the product checklist and [UI architecture](../docs/ui-product-architecture.md) as the screen/content plan.

- One-glance Operations screen: operating posture, active plan, resource margins, current changes, and next operator action.
- Five operator workspaces: Operations, Plan, Monitor, Scenario Lab, and Decision Record. Capabilities appear within these jobs rather than as marketing cards.
- Dark engineering workstation, restrained glass in the frame, and readable opaque data panels.
- Decision-focused energy/reserve plots, mission timelines, plan comparison, and traceable alerts.
- Movement only from explicit simulation playback or operator actions. Missing values remain unavailable, not fabricated.
- Technical provenance accessible on demand; model outputs must not be presented as live station measurements or proven industrial deployment.

## Delivery boundaries

1. **Foundation and Operations:** standalone application, shared shell, selected-case state, existing API integration, and the first reviewable desktop view.
2. **Plan and Monitor:** lifecycle actions, comparison, explanations, clock controls, and adaptive response.
3. **Scenario Lab and Decision Record:** case exploration, decision history, visual/accessibility QA, and a rehearsed presentation flow.

Targeted stress testing selects the verified baseline/disruption story alongside the first two stages. Full final evaluation follows the complete workflow. No stage is complete merely because its source files exist.

## Preservation rule

Do not overwrite or remove the existing root `src/` frontend as part of this rebuild. Switch the default application only after the new interface is reviewed and passes the backend-linked demonstration checklist.
