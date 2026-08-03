import { createFileRoute } from "@tanstack/react-router";

import { UnlockGate } from "@/features/unlock/UnlockGate.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009).
export const Route = createFileRoute("/")({
  component: UnlockGate,
});
