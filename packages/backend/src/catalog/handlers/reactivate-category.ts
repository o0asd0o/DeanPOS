import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setCategoryArchived } from "../db-operations/commands/set-category-archived.command.ts";
import { setCategorySortOrder } from "../db-operations/commands/set-category-sort-order.command.ts";
import { nextCategorySortOrder } from "../db-operations/queries/next-category-sort-order.query.ts";
import { toCategoryOutput } from "../helpers.ts";

export const inputSchema = z.object({ id: z.string() });
type Input = z.infer<typeof inputSchema>;
type CategoryOutput = ReturnType<typeof toCategoryOutput>;

// Reactivate unconfirmed (038/041). Park at end of active list to avoid unique sort collisions.
export const handler: Handler<Input, CategoryOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  const row = await withTenantScope(ctx.db, tenantId, async (db) => {
    // Park sort while still archived so unique active sort indexes never collide.
    const sortOrder = await nextCategorySortOrder(db);
    const parked = await setCategorySortOrder(db, input.id, sortOrder);
    if (!parked) return null;
    return setCategoryArchived(db, input.id, null);
  });
  return row ? toCategoryOutput(row) : null;
};
