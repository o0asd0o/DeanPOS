import { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getStore } from "../db-operations/queries/get-store.query.ts";

export const inputSchema = z.object({ id: z.string() });

type StoreRow = NonNullable<Awaited<ReturnType<typeof getStore>>>;

// Not-found or empty, never another Tenant's row — the wrong-tenant probe
// this issue's own procedure demonstrates (issue 01, tenant-isolation-spine).
export const handler: Handler<{ id: string }, StoreRow | null> = async ({ ctx, input }) => {
  const store = await withTenantScope(ctx.db, ctx.principal?.tenantId ?? null, (scopedDb) =>
    getStore(scopedDb, input.id),
  );
  return store ?? null;
};
