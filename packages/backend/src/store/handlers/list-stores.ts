import { getAssignedStoreIdsAsOf } from "../../access/db-operations/queries/get-assigned-store-ids-as-of.query.ts";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listStores } from "../db-operations/queries/list-stores.query.ts";
import { toStoreOutput } from "../helpers.ts";

type StoreOutput = ReturnType<typeof toStoreOutput>;

// Refused entirely for `cashier` (empty array, never an error — record
// 038 §6 forbids disclosing anything about a Store the caller may not see).
// A `manager` sees only their assigned Stores; `admin` is exempt from Store
// membership by construction (same rule as store.get's canAccessStore).
export const handler: Handler<void, StoreOutput[]> = async ({ ctx }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId || !ctx.principal.role) return [];
  const { tenantId, userId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return [];

  const stores = await withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const rows = await listStores(scopedDb);
    if (role === "admin") return rows;
    const assignedIds = new Set(await getAssignedStoreIdsAsOf(scopedDb, userId, new Date()));
    return rows.filter((row) => assignedIds.has(row.id));
  });

  return stores.map(toStoreOutput);
};
