import { randomUUID } from "node:crypto";
import { catalogMenuItemAddOnInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getAddOn } from "../../add-on/db-operations/queries/get-add-on.query.ts";
import { toAddOnOutput } from "../../add-on/helpers.ts";
import { insertMenuItemAddOn } from "../db-operations/commands/insert-menu-item-add-on.command.ts";
import { getMenuItem } from "../db-operations/queries/get-menu-item.query.ts";
import {
  guardEffectivePriceForItem,
  NegativeEffectivePriceError,
} from "../guard-effective-price.ts";
export const inputSchema = catalogMenuItemAddOnInputSchema;
type Input = z.infer<typeof inputSchema>;
export const handler: Handler<Input, ReturnType<typeof toAddOnOutput> | null> = async ({
  ctx,
  input,
}) => {
  if (
    ctx.kind !== "tenant" ||
    !ctx.principal.role ||
    !hasAtLeastRole(ctx.principal.role, "manager")
  )
    return null;
  try {
    return await withTenantScope(ctx.db, ctx.principal.tenantId, async (db) => {
      const item = await getMenuItem(db, input.menuItemId);
      const addOn = await getAddOn(db, input.addOnId);
      if (!item || item.archived_at || !addOn || addOn.archived_at) return null;
      const existing = await db
        .selectFrom("MenuItemAddOn")
        .select("id")
        .where("menu_item_id", "=", input.menuItemId)
        .where("add_on_id", "=", input.addOnId)
        .executeTakeFirst();
      if (!existing)
        await insertMenuItemAddOn(
          db,
          randomUUID(),
          ctx.principal.tenantId,
          input.menuItemId,
          input.addOnId,
        );
      await guardEffectivePriceForItem(db, input.menuItemId);
      const updated = await getAddOn(db, input.addOnId);
      return updated ? toAddOnOutput(updated, updated.linked_to_count) : null;
    });
  } catch (error) {
    if (error instanceof NegativeEffectivePriceError) return null;
    throw error;
  }
};
