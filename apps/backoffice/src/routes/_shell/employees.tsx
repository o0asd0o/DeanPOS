import { createFileRoute } from "@tanstack/react-router";

import type { RoleFilter } from "@/components/ListToolbar.tsx";
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

// Thin: wires the route to the feature and nothing else (ADR-0009, record 044 §1).
// `manager` — `list-users.ts` already refuses below it (issue 15, record 063 §4).
export const Route = createFileRoute("/_shell/employees")({
  staticData: { minRole: "manager" },
  validateSearch: (search: Record<string, unknown>) => ({
    role: parseRole(search.role),
    store: parseStore(search.store),
    q: parseQuery(search.q),
  }),
  component: Users,
});
