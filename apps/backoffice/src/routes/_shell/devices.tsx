import { createFileRoute } from "@tanstack/react-router";

import type { HealthFilter } from "@/components/ListToolbar.tsx";
import type { DeviceListSort, DeviceListSortKey } from "@/features/devices/helpers.ts";
import { Devices } from "@/features/devices/Devices.tsx";

// The screen's filters ride the URL (record 056 Q5): a filtered view survives
// a trip to a row's Edit sheet and back, and a shared link lands on the same
// fleet. Anything absent or malformed falls back to no filter.
const HEALTH: HealthFilter[] = ["all", "online", "stale", "offline"];

const parseHealth = (value: unknown): HealthFilter =>
  HEALTH.includes(value as HealthFilter) ? (value as HealthFilter) : "all";

const parseStore = (value: unknown): string =>
  typeof value === "string" && value !== "" ? value : "all";

const parseQuery = (value: unknown): string =>
  typeof value === "string" ? value.slice(0, 100) : "";

const SORT_KEYS: DeviceListSortKey[] = ["name", "store", "assignedTo", "lastSeen", "status"];

// TanStack's default stringify JSON-encodes complex values, so `sort`
// arrives as the object; the `key:direction` string form is accepted for
// hand-written URLs.
const parseSort = (value: unknown): DeviceListSort => {
  const candidate =
    typeof value === "object" && value !== null
      ? (value as { key?: unknown; direction?: unknown })
      : typeof value === "string"
        ? { key: value.split(":")[0], direction: value.split(":")[1] }
        : {};
  if (
    SORT_KEYS.includes(candidate.key as DeviceListSortKey) &&
    (candidate.direction === "asc" || candidate.direction === "desc")
  ) {
    return { key: candidate.key as DeviceListSortKey, direction: candidate.direction };
  }
  return { key: "name", direction: "asc" };
};

const parsePage = (value: unknown): number => {
  // Navigate hands the typed value (number); the URL round-trip hands a
  // string — accept both, or the default silently eats a page change.
  const page = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(page) && page >= 1 ? page : 1;
};

// Thin: wires the route to the feature and nothing else (ADR-0009). `admin`
// only — `_shell`'s own guard refuses, not this route (issue 15, record 063 §1).
export const Route = createFileRoute("/_shell/devices")({
  staticData: { minRole: "admin" },
  validateSearch: (search: Record<string, unknown>) => ({
    health: parseHealth(search.health),
    store: parseStore(search.store),
    q: parseQuery(search.q),
    sort: parseSort(search.sort),
    page: parsePage(search.page),
  }),
  component: Devices,
});
