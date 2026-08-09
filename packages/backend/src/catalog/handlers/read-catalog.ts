import { catalogReadInputSchema, type catalogReadOutputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { selectCatalogRead } from "../db-operations/queries/catalog-version.query.ts";
import { getStore } from "../../store/db-operations/queries/get-store.query.ts";
import { canAccessStore } from "../../common/authorize.ts";

export const inputSchema = catalogReadInputSchema;
type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof catalogReadOutputSchema>;

export const handler: Handler<Input, Output> = async ({ ctx, input }) => {
  const tenantId =
    ctx.kind === "tenant"
      ? ctx.principal.tenantId
      : ctx.kind === "device"
        ? ctx.device.tenantId
        : null;
  if (!tenantId) {
    return { categories: [], menuItems: [], discounts: [], version: "0".repeat(64) };
  }

  return withTenantScope(ctx.db, tenantId, async (db) => {
    const store = await getStore(db, input.storeId);
    const authorized =
      ctx.kind === "device"
        ? ctx.device.storeId === input.storeId
        : ctx.kind === "tenant"
          ? !!ctx.principal.userId &&
            !!ctx.principal.role &&
            (await canAccessStore(db, ctx.principal.userId, ctx.principal.role, input.storeId))
          : false;
    if (!store || !authorized)
      return { categories: [], menuItems: [], discounts: [], version: "0".repeat(64) };
    const result = await selectCatalogRead(db, input.storeId);
    return { ...(result.content as Omit<Output, "version">), version: result.version };
  });
};
