import { randomUUID } from "node:crypto";

import { catalogMenuItemCreateInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertMenuItem } from "../db-operations/commands/insert-menu-item.command.ts";
import { getCategory } from "../db-operations/queries/get-category.query.ts";
import { nextMenuItemSortOrder } from "../db-operations/queries/next-menu-item-sort-order.query.ts";
import { toMenuItemOutput } from "../helpers.ts";

export const inputSchema = catalogMenuItemCreateInputSchema;
type Input = z.infer<typeof inputSchema>;
type MenuItemOutput = ReturnType<typeof toMenuItemOutput>;

export const handler: Handler<Input, MenuItemOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  const row = await withTenantScope(ctx.db, tenantId, async (db) => {
    const category = await getCategory(db, input.categoryId);
    if (!category || category.archived_at) return null;
    const sortOrder = await nextMenuItemSortOrder(db, input.categoryId);
    return insertMenuItem(db, {
      id: randomUUID(),
      tenantId,
      categoryId: input.categoryId,
      name: input.name,
      sortOrder,
    });
  });
  return row ? toMenuItemOutput(row) : null;
};
