import { catalogMenuItemMoveInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { moveMenuItem } from "../db-operations/commands/move-menu-item.command.ts";
import { getCategory } from "../db-operations/queries/get-category.query.ts";
import { getMenuItem } from "../db-operations/queries/get-menu-item.query.ts";
import { nextMenuItemSortOrder } from "../db-operations/queries/next-menu-item-sort-order.query.ts";
import { toMenuItemOutput } from "../helpers.ts";

export const inputSchema = catalogMenuItemMoveInputSchema;
type Input = z.infer<typeof inputSchema>;
type MenuItemOutput = ReturnType<typeof toMenuItemOutput>;

export const handler: Handler<Input, MenuItemOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  try {
    const row = await withTenantScope(ctx.db, tenantId, async (db) => {
      const item = await getMenuItem(db, input.id);
      if (!item || item.archived_at) return null;
      const category = await getCategory(db, input.categoryId);
      if (!category || category.archived_at) return null;
      if (item.category_id === input.categoryId) return item;
      const sortOrder = await nextMenuItemSortOrder(db, input.categoryId);
      return moveMenuItem(db, input.id, { categoryId: input.categoryId, sortOrder });
    });
    return row ? toMenuItemOutput(row) : null;
  } catch {
    return null;
  }
};
