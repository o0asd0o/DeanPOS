import { catalogMenuItemModifierGroupInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getMenuItem } from "../db-operations/queries/get-menu-item.query.ts";
import { getModifierGroup } from "../../modifier-group/db-operations/queries/get-modifier-group.query.ts";
import { deleteMenuItemModifierGroup } from "../db-operations/commands/delete-menu-item-modifier-group.command.ts";

export const inputSchema = catalogMenuItemModifierGroupInputSchema;
type Input = z.infer<typeof inputSchema>;

export const handler: Handler<Input, { ok: boolean }> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return { ok: false };
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return { ok: false };

  return withTenantScope(ctx.db, tenantId, async (db) => {
    const menuItem = await getMenuItem(db, input.menuItemId);
    if (!menuItem) return { ok: false };

    const group = await getModifierGroup(db, input.modifierGroupId);
    if (!group) return { ok: false };

    await deleteMenuItemModifierGroup(db, input.menuItemId, input.modifierGroupId);
    return { ok: true };
  });
};
