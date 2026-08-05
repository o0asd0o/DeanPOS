import { createFileRoute } from "@tanstack/react-router";

import { Options } from "@/features/options/Options.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009).
// Path stays /add-ons; leaf label is Options (catalog issue 03).
export const Route = createFileRoute("/_shell/add-ons")({
  staticData: { minRole: "manager" },
  component: Options,
});
