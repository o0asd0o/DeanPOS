import { createFileRoute } from "@tanstack/react-router";

import { Placeholder } from "@/features/placeholder/Placeholder.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009). `admin`
// until it ships — destination is `cashier`, self-scoped, counted cash only
// (record 063 Amendment 1; expected cash stays `manager`/`admin`, PRD:316).
export const Route = createFileRoute("/_shell/reports/drawer-sessions")({
  staticData: { minRole: "admin" },
  component: () => <Placeholder title="Drawer sessions" />,
});
