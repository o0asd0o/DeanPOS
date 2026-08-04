import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setMenuItemArchived } from "../db-operations/commands/set-menu-item-archived.command.ts";
import { setMenuItemSortOrder } from "../db-operations/commands/set-menu-item-sort-order.command.ts";
import { getMenuItem } from "../db-operations/queries/get-menu-item.query.ts";
import { nextMenuItemSortOrder } from "../db-operations/queries/next-menu-item-sort-order.query.ts";
import { toMenuItemOutput } from "../helpers.ts";

export const inputSchema = z.object({ id: z.string() });
type Input = z.infer<typeof inputSchema>;
type MenuItemOutput = ReturnType<typeof toMenuItemOutput>;

export const handler: Handler<Input, MenuItemOutput | null> = async ({
  ctx,
  input,
}) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  const row = await withTenantScope(ctx.db, tenantId, async (db) => {
    const item = await getMenuItem(db, input.id);
    if (!item) return null;
    // Park sort while still archived so unique active sort indexes never collide.
    const sortOrder = await nextMenuItemSortOrder(db, item.category_id);
    const parked = await setMenuItemSortOrder(db, input.id, sortOrder);
    if (!parked) return null;
    return setMenuItemArchived(db, input.id, null);
  });
  return row ? toMenuItemOutput(row) : null;
};
