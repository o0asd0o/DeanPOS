export type Role = "cashier" | "manager" | "admin";

// cashier < manager < admin (PRD "Authorisation model"), the same order
// `common/authorize.ts` enforces server-side. Presentation only here — the
// router's `_shell` guard and the sidebar filter both read this, the
// handlers enforce it independently (record 046 §4).
const RANK: Record<Role, number> = { cashier: 0, manager: 1, admin: 2 };

export const hasAtLeastRole = (role: Role, minRole: Role): boolean => RANK[role] >= RANK[minRole];
