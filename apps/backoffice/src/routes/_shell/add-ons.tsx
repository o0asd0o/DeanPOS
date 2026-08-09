import { createFileRoute } from "@tanstack/react-router";

import { Options } from "@/features/catalog/options/Options.tsx";
import type { UsageFilter } from "@/components/ListToolbar.tsx";

const USAGES: UsageFilter[] = ["all", "inuse", "needsattention", "unused"];
const parseUsage = (value: unknown): UsageFilter =>
  USAGES.includes(value as UsageFilter) ? (value as UsageFilter) : "all";
const parseQuery = (value: unknown) => (typeof value === "string" ? value.slice(0, 100) : "");

// Thin: wires the route to the feature and nothing else (ADR-0009).
// Path stays /add-ons; leaf label is Options (catalog issue 03).
export const Route = createFileRoute("/_shell/add-ons")({
  staticData: { minRole: "manager" },
  validateSearch: (search: Record<string, unknown>) => ({
    usage: parseUsage(search.usage),
    q: parseQuery(search.q),
  }),
  component: Options,
});
