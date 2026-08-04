import { createFileRoute } from "@tanstack/react-router";

import { Ping } from "@/features/ping/Ping.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009). `cashier`
// — every signed-in role lands here (issue 15, record 063 §4).
export const Route = createFileRoute("/_shell/")({
  staticData: { minRole: "cashier" },
  component: Ping,
});
