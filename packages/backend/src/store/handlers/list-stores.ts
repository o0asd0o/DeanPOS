import { getAssignedStoreIdsAsOf } from "../../access/db-operations/queries/get-assigned-store-ids-as-of.query.ts";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listStores } from "../db-operations/queries/list-stores.query.ts";
import { toStoreOutput } from "../helpers.ts";
import { storeListInputSchema } from "contract/src/routes/store/schemas.ts";

type ListInput = z.infer<typeof storeListInputSchema>;
type ListResult = Awaited<ReturnType<typeof listStores>>;
type ListOutput = Omit<ListResult, "items"> & { items: ReturnType<typeof toStoreOutput>[] };

// Empty array, never an error, for `cashier`/an unassigned `manager`
// (record 038 §6).
export const handler: Handler<ListInput, ListOutput> = async ({ ctx, input }) => {
  const emptyPage = {
    items: [],
    count: 0,
    page: input.page ?? 1,
    perPage: input.perPage ?? 10,
    hasNextPage: false,
    hasPrevPage: false,
    totalCount: 0,
    activeCount: 0,
  };
  if (ctx.kind !== "tenant" || !ctx.principal.userId || !ctx.principal.role) return emptyPage;
  const { tenantId, userId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return emptyPage;

  const stores = await withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const assignedIds =
      role === "admin" ? [] : await getAssignedStoreIdsAsOf(scopedDb, userId, new Date());
    const result = await listStores(scopedDb, {
      ...input,
      callerRole: role,
      callerStoreIds: assignedIds,
    });
    return { ...result, items: result.items.map(toStoreOutput) };
  });

  return stores;
};
import { z } from "zod";
