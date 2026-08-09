import { createFileRoute } from "@tanstack/react-router";

import { Options } from "@/features/catalog/options/Options.tsx";
import type { UsageFilter } from "@/components/ListToolbar.tsx";
import type { OptionListSort } from "@/features/catalog/options/helpers.ts";

const USAGES: UsageFilter[] = ["all", "inuse", "needsattention", "unused"];
const parseUsage = (value: unknown): UsageFilter =>
  USAGES.includes(value as UsageFilter) ? (value as UsageFilter) : "all";
const parseQuery = (value: unknown) => (typeof value === "string" ? value.slice(0, 100) : "");
const parsePage = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 1;
const parseSort = (value: unknown): OptionListSort => {
  if (!value || typeof value !== "object") return { key: "name", direction: "asc" };
  const { key, direction } = value as Record<string, unknown>;
  return (key === "name" ||
    key === "rule" ||
    key === "delta" ||
    key === "maximum" ||
    key === "linked" ||
    key === "status") &&
    (direction === "asc" || direction === "desc")
    ? { key, direction }
    : { key: "name", direction: "asc" };
};

// Thin: wires the route to the feature and nothing else (ADR-0009).
// Path stays /add-ons; leaf label is Options (catalog issue 03).
export const Route = createFileRoute("/_shell/add-ons")({
  staticData: { minRole: "manager" },
  validateSearch: (search: Record<string, unknown>) => ({
    usage: parseUsage(search.usage),
    q: parseQuery(search.q),
    page: parsePage(search.page),
    sort: parseSort(search.sort),
  }),
  component: Options,
});
