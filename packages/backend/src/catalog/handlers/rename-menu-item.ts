import { catalogMenuItemRenameInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { updateMenuItemName } from "../db-operations/commands/update-menu-item-name.command.ts";
import { toMenuItemOutput } from "../helpers.ts";
import { getMenuItem } from "../db-operations/queries/get-menu-item.query.ts";

export const inputSchema = catalogMenuItemRenameInputSchema;
type Input = z.infer<typeof inputSchema>;
type MenuItemOutput = ReturnType<typeof toMenuItemOutput>;

export const handler: Handler<Input, MenuItemOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  const row = await withTenantScope(ctx.db, tenantId, async (db) => {
    const updated = await updateMenuItemName(db, input.id, input.name);
    return updated ? getMenuItem(db, updated.id) : undefined;
  });
  return row ? toMenuItemOutput(row) : null;
};
