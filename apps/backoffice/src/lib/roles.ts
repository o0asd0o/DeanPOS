import type { roleSchema } from "contract/src/index.ts";

export type Role = ReturnType<typeof roleSchema.parse>;

// Presentation only — the router's `_shell` guard and the sidebar filter
// read this; handlers enforce independently (record 046 §4).
const RANK: Record<Role, number> = { cashier: 0, manager: 1, admin: 2 };

export const hasAtLeastRole = (role: Role, minRole: Role): boolean => RANK[role] >= RANK[minRole];
