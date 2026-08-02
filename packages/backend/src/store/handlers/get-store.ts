import { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getStore } from "../db-operations/queries/get-store.query.ts";

export const inputSchema = z.object({ id: z.string() });

type StoreOutput = {
  id: string;
  tenantId: string;
  name: string;
  active: boolean;
  createdAt: Date;
};

// Not-found or empty, never another Tenant's row — the wrong-tenant probe
// this issue's own procedure demonstrates (issue 01, tenant-isolation-spine).
export const handler: Handler<{ id: string }, StoreOutput | null> = async ({ ctx, input }) => {
  const store = await withTenantScope(ctx.db, ctx.principal?.tenantId ?? null, (scopedDb) =>
    getStore(scopedDb, input.id),
  );
  if (!store) return null;
  // "tenant_id" (schema.prisma @map) is the physical column; the contract's
  // response shape stays camelCase (issue 01, findings on the tenant_id rename).
  return {
    id: store.id,
    tenantId: store.tenant_id,
    name: store.name,
    active: store.active,
    createdAt: store.createdAt,
  };
};
