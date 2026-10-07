import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceCaseStudies } from "@/components/firn/workspace-support";

export const Route = createFileRoute("/case-studies")({
  head: () => ({
    meta: [
      { title: "Case Studies — FIRN" },
      {
        name: "description",
        content:
          "Illustrative mission-and-energy planning cases derived from FIRN's current simulation model.",
      },
    ],
  }),
  component: WorkspaceCaseStudies,
});
