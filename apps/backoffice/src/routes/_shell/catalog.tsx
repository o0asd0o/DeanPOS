import { createFileRoute } from "@tanstack/react-router";

import { Catalog } from "@/features/catalog/Catalog.tsx";
import type { SellabilityFilter } from "@/components/ListToolbar.tsx";
import type { MenuItemListSort } from "@/features/catalog/helpers.ts";

const STATUSES: SellabilityFilter[] = ["all", "live", "draft", "archived"];
const parseStatus = (value: unknown): SellabilityFilter =>
  STATUSES.includes(value as SellabilityFilter) ? (value as SellabilityFilter) : "all";
const parseQuery = (value: unknown) => (typeof value === "string" ? value.slice(0, 100) : "");
const parseCategory = (value: unknown) => (typeof value === "string" ? value : "");
const parsePage = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 1;
const parseSort = (value: unknown): MenuItemListSort => {
  if (!value || typeof value !== "object") return { key: "sortOrder", direction: "asc" };
  const { key, direction } = value as Record<string, unknown>;
  return (key === "name" || key === "price" || key === "sortOrder") &&
    (direction === "asc" || direction === "desc")
    ? { key, direction }
    : { key: "sortOrder", direction: "asc" };
};

// Thin: wires the route to the feature and nothing else (ADR-0009).
export const Route = createFileRoute("/_shell/catalog")({
  staticData: { minRole: "manager" },
  validateSearch: (search: Record<string, unknown>) => ({
    status: parseStatus(search.status),
    q: parseQuery(search.q),
    category: parseCategory(search.category),
    page: parsePage(search.page),
    sort: parseSort(search.sort),
  }),
  component: Catalog,
});
