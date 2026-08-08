import { createFileRoute } from "@tanstack/react-router";

import type { RoleFilter } from "@/components/ListToolbar.tsx";
import type { UserListSort, UserListSortKey } from "@/features/users/helpers.ts";
import { Users } from "@/features/users/Users.tsx";

// The screen's filters ride the URL (record 056 Q5's pattern, applied to the
// roster): a filtered view survives a trip to a row's editor and back, and a
// shared link lands on the same fleet. Anything absent or malformed falls
// back to no filter.
const ROLES: RoleFilter[] = ["all", "cashier", "manager", "admin"];

const parseRole = (value: unknown): RoleFilter =>
  ROLES.includes(value as RoleFilter) ? (value as RoleFilter) : "all";

const parseStore = (value: unknown): string =>
  typeof value === "string" && value !== "" ? value : "all";

const parseQuery = (value: unknown): string =>
  typeof value === "string" ? value.slice(0, 100) : "";

const SORT_KEYS: UserListSortKey[] = ["name", "email", "role", "status"];

// TanStack's default stringify JSON-encodes complex values, so `sort`
// arrives as the object; the `key:direction` string form is accepted for
// hand-written URLs.
const parseSort = (value: unknown): UserListSort => {
  const candidate =
    typeof value === "object" && value !== null
      ? (value as { key?: unknown; direction?: unknown })
      : typeof value === "string"
        ? { key: value.split(":")[0], direction: value.split(":")[1] }
        : {};
  if (
    SORT_KEYS.includes(candidate.key as UserListSortKey) &&
    (candidate.direction === "asc" || candidate.direction === "desc")
  ) {
    return { key: candidate.key as UserListSortKey, direction: candidate.direction };
  }
  return { key: "name", direction: "asc" };
};

const parsePage = (value: unknown): number => {
  // Navigate hands the typed value (number); the URL round-trip hands a
  // string — accept both, or the default silently eats a page change.
  const page = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(page) && page >= 1 ? page : 1;
};

// Thin: wires the route to the feature and nothing else (ADR-0009, record 044 §1).
// `manager` — `list-users.ts` already refuses below it (issue 15, record 063 §4).
export const Route = createFileRoute("/_shell/employees")({
  staticData: { minRole: "manager" },
  validateSearch: (search: Record<string, unknown>) => ({
    role: parseRole(search.role),
    store: parseStore(search.store),
    q: parseQuery(search.q),
    sort: parseSort(search.sort),
    page: parsePage(search.page),
  }),
  component: Users,
});
