import { createFileRoute } from "@tanstack/react-router";

import { Overrides } from "@/features/overrides/Overrides.tsx";

// Thin: wires the route to the feature (ADR-0009). `manager`-or-above per
// record 060 Q5; `_shell` enforces the gate (record 063 §1).
export const Route = createFileRoute("/_shell/reports/discounts-overrides")({
  staticData: { minRole: "manager" },
  component: Overrides,
});
