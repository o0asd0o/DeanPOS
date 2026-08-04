import { z } from "zod";

import { getAssignedStoreIdsAsOf } from "../../access/db-operations/queries/get-assigned-store-ids-as-of.query.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import type { Role } from "../../db/prisma/generated/types.ts";
import { listStores } from "../../store/db-operations/queries/list-stores.query.ts";

export const inputSchema = z.void();

type MeOutput =
  | { authenticated: false }
  | {
      authenticated: true;
      mustChangePassword: boolean;
      role: Role;
      userId?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      stores?: { id: string; name: string }[];
    };

// What `_shell`'s `beforeLoad` guard reads (record 030). `role` (record 038
// §6) and `userId` (record 044 §4 clause 2) feed the Stores/Users screens.
// `firstName`/`lastName` and `stores` (issue 15, record 063 Amendment 1)
// feed `/account` — `stores` is the caller's own assignment, read the same
// way for every role, never the Store-list handler's manager-and-above gate.
export const handler: Handler<void, MeOutput> = async ({ ctx }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return { authenticated: false };
  const { tenantId, userId, role, mustChangePassword, email, firstName, lastName } = ctx.principal;

  const stores = userId
    ? await withTenantScope(ctx.db, tenantId, async (scopedDb) => {
        const assignedIds = new Set(await getAssignedStoreIdsAsOf(scopedDb, userId, new Date()));
        if (assignedIds.size === 0) return [];
        const rows = await listStores(scopedDb);
        return rows
          .filter((row) => assignedIds.has(row.id))
          .map((row) => ({ id: row.id, name: row.name }));
      })
    : [];

  return {
    authenticated: true,
    mustChangePassword: mustChangePassword ?? false,
    role,
    userId,
    email,
    firstName,
    lastName,
    stores,
  };
};
