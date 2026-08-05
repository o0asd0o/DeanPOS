import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { countActiveVariantsByMenuItem } from "../../variant/db-operations/queries/count-active-variants-by-menu-item.query.ts";
import { getMenuItem } from "../db-operations/queries/get-menu-item.query.ts";
import { toMenuItemOutput } from "../helpers.ts";

export const inputSchema = z.object({ id: z.string() });
type Input = z.infer<typeof inputSchema>;
type MenuItemOutput = ReturnType<typeof toMenuItemOutput>;

export const handler: Handler<Input, MenuItemOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  return withTenantScope(ctx.db, tenantId, async (db) => {
    const row = await getMenuItem(db, input.id);
    if (!row) return null;
    const counts = await countActiveVariantsByMenuItem(db, [row.id]);
    return toMenuItemOutput(row, (counts.get(row.id) ?? 0) > 0);
  });
};
