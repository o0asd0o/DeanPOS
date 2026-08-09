import { createFileRoute } from "@tanstack/react-router";

import { Discounts } from "@/features/discounts/Discounts.tsx";

const STATUSES = ["all", "active", "archived"] as const;
const parseStatus = (value: unknown) =>
  STATUSES.includes(value as (typeof STATUSES)[number])
    ? (value as (typeof STATUSES)[number])
    : "all";
const parseQuery = (value: unknown) => (typeof value === "string" ? value.slice(0, 100) : "");

export const Route = createFileRoute("/_shell/discounts")({
  staticData: { minRole: "manager" },
  validateSearch: (search: Record<string, unknown>) => ({
    status: parseStatus(search.status),
    q: parseQuery(search.q),
  }),
  component: Discounts,
});
