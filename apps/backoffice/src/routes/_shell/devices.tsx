import { createFileRoute } from "@tanstack/react-router";

import { Devices } from "@/features/devices/Devices.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009). `admin`
// only — `_shell`'s own guard refuses, not this route (issue 15, record 063 §1).
export const Route = createFileRoute("/_shell/devices")({
  staticData: { minRole: "admin" },
  component: Devices,
});
