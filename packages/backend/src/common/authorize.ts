import type { DatabaseInstance } from "../db/client.ts";
import { getAssignedStoreIdsAsOf } from "../access/db-operations/queries/get-assigned-store-ids-as-of.query.ts";
import type { Role } from "../db/prisma/generated/types.ts";

const ROLE_RANK: Record<Role, number> = { cashier: 0, manager: 1, admin: 2 };

// cashier < manager < admin (PRD "Authorisation model"). Role answers *what
// kind of action*; canAccessStore below answers *where*.
export const hasAtLeastRole = (role: Role, min: Role): boolean => ROLE_RANK[role] >= ROLE_RANK[min];

// `admin` is exempt from Store membership by construction — the PRD's
// per-role, per-surface table names this the single most likely defect to
// get backwards. `db` must already be scoped to the caller's own Tenant.
export const canAccessStore = async (
  db: DatabaseInstance,
  userId: string,
  role: Role,
  storeId: string,
): Promise<boolean> => {
  if (role === "admin") return true;
  const storeIds = await getAssignedStoreIdsAsOf(db, userId, new Date());
  return storeIds.includes(storeId);
};
