import { createFileRoute } from "@tanstack/react-router";

import type { ReachFilter } from "@/components/ListToolbar.tsx";
import { PaymentMethods } from "@/features/payment-methods/PaymentMethods.tsx";

// The screen's filters ride the URL (record 056 Q5's rule, applied here): a
// filtered view survives a trip to a row's editor and back, and a shared link
// lands on the same set. Anything absent or malformed falls back to no filter.
const REACH: ReachFilter[] = ["all", "live", "nostores", "deactivated"];

const parseReach = (value: unknown): ReachFilter =>
  REACH.includes(value as ReachFilter) ? (value as ReachFilter) : "all";

const parseStore = (value: unknown): string =>
  typeof value === "string" && value !== "" ? value : "all";

const parseQuery = (value: unknown): string =>
  typeof value === "string" ? value.slice(0, 100) : "";

// Thin: wires the route to the feature and nothing else (ADR-0009, record 038 §1).
// `admin` only — the handlers already refuse below it (issue 15, record 063 §4).
export const Route = createFileRoute("/_shell/payment-methods")({
  staticData: { minRole: "admin" },
  validateSearch: (search: Record<string, unknown>) => ({
    reach: parseReach(search.reach),
    store: parseStore(search.store),
    q: parseQuery(search.q),
  }),
  component: PaymentMethods,
});
