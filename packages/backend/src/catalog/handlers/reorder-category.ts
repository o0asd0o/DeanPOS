import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setCategorySortOrder } from "../db-operations/commands/set-category-sort-order.command.ts";
import { getCategory } from "../db-operations/queries/get-category.query.ts";
import { listActiveCategories } from "../db-operations/queries/list-active-categories.query.ts";
import { toCategoryOutput } from "../helpers.ts";

export const inputSchema = z.object({
  id: z.string(),
  direction: z.enum(["up", "down"]),
});
type Input = z.infer<typeof inputSchema>;
type CategoryOutput = ReturnType<typeof toCategoryOutput>;

// Swap with neighbour. Concurrent conflict → unique index refuses (issue 01 Comments).
export const handler: Handler<Input, CategoryOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  try {
    const row = await withTenantScope(ctx.db, tenantId, async (db) => {
      const current = await getCategory(db, input.id);
      if (!current || current.archived_at) return null;

      const active = await listActiveCategories(db);
      const index = active.findIndex((c) => c.id === current.id);
      if (index < 0) return null;
      const neighbourIndex = input.direction === "up" ? index - 1 : index + 1;
      if (neighbourIndex < 0 || neighbourIndex >= active.length) return current;

      const neighbour = active[neighbourIndex]!;
      const currentOrder = current.sort_order;
      const neighbourOrder = neighbour.sort_order;

      // Park current on a free temp slot outside active range, then swap.
      const temp = Math.max(...active.map((c) => c.sort_order), 0) + 1000;
      await setCategorySortOrder(db, current.id, temp);
      await setCategorySortOrder(db, neighbour.id, currentOrder);
      return setCategorySortOrder(db, current.id, neighbourOrder);
    });
    return row ? toCategoryOutput(row) : null;
  } catch {
    return null;
  }
};
