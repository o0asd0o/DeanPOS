import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setMenuItemArchived } from "../db-operations/commands/set-menu-item-archived.command.ts";
import { toMenuItemOutput } from "../helpers.ts";
import { getMenuItem } from "../db-operations/queries/get-menu-item.query.ts";

export const inputSchema = z.object({ id: z.string() });
type Input = z.infer<typeof inputSchema>;
type MenuItemOutput = ReturnType<typeof toMenuItemOutput>;

export const handler: Handler<Input, MenuItemOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  const row = await withTenantScope(ctx.db, tenantId, async (db) => {
    const updated = await setMenuItemArchived(db, input.id, new Date());
    return updated ? getMenuItem(db, updated.id) : undefined;
  });
  return row ? toMenuItemOutput(row) : null;
};
