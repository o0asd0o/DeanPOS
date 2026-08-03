import { createFileRoute } from "@tanstack/react-router";

import { Devices } from "@/features/devices/Devices.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009).
export const Route = createFileRoute("/_shell/devices")({
  component: Devices,
});
