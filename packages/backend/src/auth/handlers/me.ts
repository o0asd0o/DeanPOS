import { z } from "zod";

import { getAssignedStoreIdsAsOf } from "../../access/db-operations/queries/get-assigned-store-ids-as-of.query.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import type { Role } from "../../db/prisma/generated/types.ts";
import { listStoresByIds } from "../../store/db-operations/queries/list-stores-by-ids.query.ts";

export const inputSchema = z.void();

type MeOutput =
  | { authenticated: false }
  | {
      authenticated: true;
      mustChangePassword: boolean;
      role: Role;
      userId?: string;
      email?: string;
      firstName: string;
      lastName: string;
      stores: { id: string; name: string }[];
    };

// What `_shell`'s `beforeLoad` guard reads (record 030). `firstName`/
// `lastName`/`stores` feed `/account` (issue 15, record 063 Amendment 1).
export const handler: Handler<void, MeOutput> = async ({ ctx }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return { authenticated: false };
  const { tenantId, userId, role, mustChangePassword, email, firstName, lastName } = ctx.principal;

  const stores = userId
    ? await withTenantScope(ctx.db, tenantId, async (scopedDb) => {
        const assignedIds = await getAssignedStoreIdsAsOf(scopedDb, userId, new Date());
        if (assignedIds.length === 0) return [];
        const rows = await listStoresByIds(scopedDb, assignedIds);
        return rows.map((row) => ({ id: row.id, name: row.name }));
      })
    : [];

  return {
    authenticated: true,
    mustChangePassword: mustChangePassword ?? false,
    role,
    userId,
    email,
    firstName: firstName ?? "",
    lastName: lastName ?? "",
    stores,
  };
};
