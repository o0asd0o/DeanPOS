import { getAssignedStoreIdsAsOf } from "../../access/db-operations/queries/get-assigned-store-ids-as-of.query.ts";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listUsers } from "../db-operations/queries/list-users.query.ts";
import { toUserOutput } from "../helpers.ts";

type UserOutput = ReturnType<typeof toUserOutput>;

// Empty array, never an error, for `cashier` (record 044 §2, mirroring
// `store.list`). No count, no total is ever disclosed to a caller who
// cannot see every row — the array itself is the only shape.
export const handler: Handler<void, UserOutput[]> = async ({ ctx }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId || !ctx.principal.role) return [];
  const { tenantId, userId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return [];

  return withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const users = await listUsers(scopedDb);
    const now = new Date();

    if (role === "admin") {
      const results: UserOutput[] = [];
      for (const user of users) {
        const storeIds = await getAssignedStoreIdsAsOf(scopedDb, user.id, now);
        results.push(toUserOutput(user, storeIds));
      }
      return results;
    }

    // A manager sees the Users assigned to their own Stores, and always
    // themselves (record 044 §2). The Stores cell is projected through the
    // caller's own visibility, server-side — never the caller's full
    // assignment set (record 044 §2 clause 3).
    const callerStoreIds = new Set(await getAssignedStoreIdsAsOf(scopedDb, userId, now));
    const results: UserOutput[] = [];
    for (const user of users) {
      const storeIds = (await getAssignedStoreIdsAsOf(scopedDb, user.id, now)).filter((id) =>
        callerStoreIds.has(id),
      );
      if (user.id !== userId && storeIds.length === 0) continue;
      results.push(toUserOutput(user, storeIds));
    }
    return results;
  });
};
