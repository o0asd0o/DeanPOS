import { z } from "zod";

import { canAccessStore, hasAtLeastRole } from "../../common/authorize.ts";
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

// Not-found, empty, and refused all return the same `null` — never a shape
// that discloses whether the Store exists but is out of reach (issue 01's
// wrong-tenant probe; issue 04's role and Store-membership gate).
export const handler: Handler<{ id: string }, StoreOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId || !ctx.principal.role) return null;
  const { tenantId, userId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  const store = await withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    if (!(await canAccessStore(scopedDb, userId, role, input.id))) return null;
    return getStore(scopedDb, input.id);
  });
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
