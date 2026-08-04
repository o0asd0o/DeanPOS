import { createFileRoute } from "@tanstack/react-router";

import { Placeholder } from "@/features/placeholder/Placeholder.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009). `admin`
// until it ships — destination is `cashier`, self-scoped (record 063 Amendment 1).
export const Route = createFileRoute("/_shell/roster")({
  staticData: { minRole: "admin" },
  component: () => <Placeholder title="Roster" />,
});
