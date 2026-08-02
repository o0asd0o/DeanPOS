import { createFileRoute } from "@tanstack/react-router";

import { Placeholder } from "../../features/placeholder/Placeholder.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009).
export const Route = createFileRoute("/reports/discounts-overrides")({
  component: () => <Placeholder title="Discounts & overrides" />,
});
