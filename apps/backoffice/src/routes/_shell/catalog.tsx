import { createFileRoute } from "@tanstack/react-router";

import { Catalog } from "@/features/catalog/Catalog.tsx";
import type { SellabilityFilter } from "@/components/ListToolbar.tsx";

const STATUSES: SellabilityFilter[] = ["all", "live", "draft", "archived"];
const parseStatus = (value: unknown): SellabilityFilter =>
  STATUSES.includes(value as SellabilityFilter) ? (value as SellabilityFilter) : "all";
const parseQuery = (value: unknown) => (typeof value === "string" ? value.slice(0, 100) : "");
const parseCategory = (value: unknown) => (typeof value === "string" ? value : "");

// Thin: wires the route to the feature and nothing else (ADR-0009).
export const Route = createFileRoute("/_shell/catalog")({
  staticData: { minRole: "manager" },
  validateSearch: (search: Record<string, unknown>) => ({
    status: parseStatus(search.status),
    q: parseQuery(search.q),
    category: parseCategory(search.category),
  }),
  component: Catalog,
});
