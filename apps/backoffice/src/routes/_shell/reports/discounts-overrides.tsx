import { createFileRoute } from "@tanstack/react-router";

import { Overrides } from "@/features/overrides/Overrides.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009).
// `manager`-or-above only (record 060 Q5) — `_shell`'s own guard refuses,
// not this route (issue 15, record 063 §1); the handler enforces criterion
// 8's Store scoping, this is navigation only.
export const Route = createFileRoute("/_shell/reports/discounts-overrides")({
  staticData: { minRole: "manager" },
  component: Overrides,
});
