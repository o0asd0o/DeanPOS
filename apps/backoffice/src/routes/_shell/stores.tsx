import { createFileRoute } from "@tanstack/react-router";

import { Stores } from "@/features/stores/Stores.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009, record 038 §1).
// `manager` — `list-stores.ts` already refuses below it (issue 15, record 063 §4).
export const Route = createFileRoute("/_shell/stores")({
  staticData: { minRole: "manager" },
  component: Stores,
});
