import { createFileRoute } from "@tanstack/react-router";

import { Ping } from "../../features/ping/Ping.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009).
export const Route = createFileRoute("/_shell/")({
  component: Ping,
});
