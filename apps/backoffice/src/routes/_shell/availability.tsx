import { createFileRoute } from "@tanstack/react-router";

import { Availability } from "@/features/availability/Availability.tsx";

const sortKeys = ["name", "menuItem", "price", "available"] as const;
const parseSort = (value: unknown) => {
  const candidate =
    typeof value === "object" && value !== null
      ? (value as { key?: unknown; direction?: unknown })
      : {};
  return {
    key: sortKeys.includes(candidate.key as (typeof sortKeys)[number])
      ? (candidate.key as (typeof sortKeys)[number])
      : "name",
    direction: candidate.direction === "desc" ? ("desc" as const) : ("asc" as const),
  };
};

// Thin: wires the route to the feature and nothing else (ADR-0009).
export const Route = createFileRoute("/_shell/availability")({
  staticData: { minRole: "admin" },
  validateSearch: (search: Record<string, unknown>) => ({
    store: typeof search.store === "string" ? search.store : "",
    q: typeof search.q === "string" ? search.q.slice(0, 100) : "",
    page:
      Number.isInteger(Number(search.page)) && Number(search.page) > 0 ? Number(search.page) : 1,
    sort: parseSort(search.sort),
  }),
  component: Availability,
});
