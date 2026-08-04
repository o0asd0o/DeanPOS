import { createFileRoute } from "@tanstack/react-router";

import { Users } from "@/features/users/Users.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009, record 044 §1).
// `manager` — `list-users.ts` already refuses below it (issue 15, record 063 §4).
export const Route = createFileRoute("/_shell/employees")({
  staticData: { minRole: "manager" },
  component: Users,
});
