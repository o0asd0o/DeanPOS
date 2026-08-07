import { randomUUID } from "node:crypto";

import { catalogMenuItemModifierGroupInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getModifierGroup } from "../../modifier-group/db-operations/queries/get-modifier-group.query.ts";
import { toModifierGroupOutput } from "../../modifier-group/helpers.ts";
import { listModifiersForGroup } from "../../modifier/db-operations/queries/list-modifiers-for-group.query.ts";
import { getMenuItem } from "../db-operations/queries/get-menu-item.query.ts";
import { guardEffectivePriceForItem, NegativeEffectivePriceError } from "../guard-effective-price.ts";
import { insertMenuItemModifierGroup } from "../db-operations/commands/insert-menu-item-modifier-group.command.ts";

export const inputSchema = catalogMenuItemModifierGroupInputSchema;
type Input = z.infer<typeof inputSchema>;

export const handler: Handler<Input, ReturnType<typeof toModifierGroupOutput> | null> = async ({
  ctx,
  input,
}) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  try {
    return await withTenantScope(ctx.db, tenantId, async (db) => {
      const menuItem = await getMenuItem(db, input.menuItemId);
      if (!menuItem || menuItem.archived_at) return null;

      const group = await getModifierGroup(db, input.modifierGroupId);
      if (!group || group.archived_at) return null;

      const existing = await db
        .selectFrom("MenuItemModifierGroup")
        .select("id")
        .where("menu_item_id", "=", input.menuItemId)
        .where("modifier_group_id", "=", input.modifierGroupId)
        .executeTakeFirst();

      if (!existing) {
        await insertMenuItemModifierGroup(
          db,
          randomUUID(),
          tenantId,
          input.menuItemId,
          input.modifierGroupId,
        );
      }

      await guardEffectivePriceForItem(db, input.menuItemId);

      const updated = await getModifierGroup(db, input.modifierGroupId);
      if (!updated) return null;
      const modifiers = await listModifiersForGroup(db, updated.id);
      return toModifierGroupOutput(updated, modifiers, updated.linked_to_count);
    });
  } catch (err) {
    if (err instanceof NegativeEffectivePriceError) return null;
    throw err;
  }
};
