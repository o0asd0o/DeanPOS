import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setMenuItemSortOrder } from "../db-operations/commands/set-menu-item-sort-order.command.ts";
import { getMenuItem } from "../db-operations/queries/get-menu-item.query.ts";
import { listActiveMenuItemsInCategory } from "../db-operations/queries/list-active-menu-items-in-category.query.ts";
import { toMenuItemOutput } from "../helpers.ts";

export const inputSchema = z.object({
  id: z.string(),
  direction: z.enum(["up", "down"]),
});
type Input = z.infer<typeof inputSchema>;
type MenuItemOutput = ReturnType<typeof toMenuItemOutput>;

export const handler: Handler<Input, MenuItemOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  try {
    const row = await withTenantScope(ctx.db, tenantId, async (db) => {
      const current = await getMenuItem(db, input.id);
      if (!current || current.archived_at) return null;

      const active = await listActiveMenuItemsInCategory(db, current.category_id);
      const index = active.findIndex((item) => item.id === current.id);
      if (index < 0) return null;
      const neighbourIndex = input.direction === "up" ? index - 1 : index + 1;
      if (neighbourIndex < 0 || neighbourIndex >= active.length) return current;

      const neighbour = active[neighbourIndex]!;
      const currentOrder = current.sort_order;
      const neighbourOrder = neighbour.sort_order;
      const temp = Math.max(...active.map((item) => item.sort_order), 0) + 1000;
      await setMenuItemSortOrder(db, current.id, temp);
      await setMenuItemSortOrder(db, neighbour.id, currentOrder);
      const reordered = await setMenuItemSortOrder(db, current.id, neighbourOrder);
      return reordered ? getMenuItem(db, reordered.id) : undefined;
    });
    return row ? toMenuItemOutput(row) : null;
  } catch {
    return null;
  }
};
