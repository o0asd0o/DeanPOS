import { createFileRoute } from "@tanstack/react-router";

import { Stores } from "@/features/stores/Stores.tsx";
import type { StatusFilter } from "@/components/ListToolbar.tsx";
import type { StoreListSort, StoreListSortKey } from "@/features/stores/helpers.ts";

const STATUSES: StatusFilter[] = ["all", "active", "deactivated"];
const parseStatus = (value: unknown): StatusFilter =>
  STATUSES.includes(value as StatusFilter) ? (value as StatusFilter) : "all";
const parseQuery = (value: unknown) => (typeof value === "string" ? value.slice(0, 100) : "");
const parseSort = (value: unknown): StoreListSort => {
  const candidate =
    typeof value === "object" && value !== null
      ? (value as { key?: unknown; direction?: unknown })
      : typeof value === "string"
        ? { key: value.split(":")[0], direction: value.split(":")[1] }
        : {};
  return ["name", "businessDayStart", "tableLabels", "status"].includes(candidate.key as string) &&
    (candidate.direction === "asc" || candidate.direction === "desc")
    ? { key: candidate.key as StoreListSortKey, direction: candidate.direction }
    : { key: "name", direction: "asc" };
};
const parsePage = (value: unknown) => {
  const page = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(page) && page >= 1 ? page : 1;
};

// Thin: wires the route to the feature and nothing else (ADR-0009, record 038 §1).
// `manager` — `list-stores.ts` already refuses below it (issue 15, record 063 §4).
export const Route = createFileRoute("/_shell/stores")({
  staticData: { minRole: "manager" },
  validateSearch: (search: Record<string, unknown>) => ({
    status: parseStatus(search.status),
    q: parseQuery(search.q),
    sort: parseSort(search.sort),
    page: parsePage(search.page),
  }),
  component: Stores,
});
