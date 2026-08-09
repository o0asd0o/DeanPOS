import { catalogReadInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { catalogVersion } from "../db-operations/queries/catalog-version.query.ts";
import { getStore } from "../../store/db-operations/queries/get-store.query.ts";
import { canAccessStore } from "../../common/authorize.ts";

export const inputSchema = catalogReadInputSchema;
type Input = z.infer<typeof inputSchema>;

// Hash only — payload never leaves the DB (record 070).
export const handler: Handler<Input, { version: string }> = async ({ ctx, input }) => {
  const tenantId =
    ctx.kind === "tenant"
      ? ctx.principal.tenantId
      : ctx.kind === "device"
        ? ctx.device.tenantId
        : null;
  if (!tenantId) return { version: "0".repeat(64) };

  const version = await withTenantScope(ctx.db, tenantId, async (db) => {
    if (!(await getStore(db, input.storeId))) return "0".repeat(64);
    if (ctx.kind === "device" && ctx.device.storeId !== input.storeId) return "0".repeat(64);
    if (
      ctx.kind === "tenant" &&
      (!ctx.principal.userId ||
        !ctx.principal.role ||
        !(await canAccessStore(db, ctx.principal.userId, ctx.principal.role, input.storeId)))
    )
      return "0".repeat(64);
    return catalogVersion(db, tenantId, input.storeId);
  });
  return { version };
};
