import { createFileRoute } from "@tanstack/react-router";

import { Users } from "@/features/users/Users.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009, record 044 §1).
export const Route = createFileRoute("/_shell/employees")({
  component: Users,
});
