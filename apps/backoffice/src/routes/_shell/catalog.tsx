import { createFileRoute } from "@tanstack/react-router";

import { Catalog } from "@/features/catalog/Catalog.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009).
export const Route = createFileRoute("/_shell/catalog")({
  staticData: { minRole: "manager" },
  component: Catalog,
});
