import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setVariantSortOrder } from "../db-operations/commands/set-variant-sort-order.command.ts";
import { getVariant } from "../db-operations/queries/get-variant.query.ts";
import { listActiveVariantsForMenuItem } from "../db-operations/queries/list-active-variants-for-menu-item.query.ts";
import { toVariantOutput } from "../helpers.ts";

export const inputSchema = z.object({
  id: z.string(),
  direction: z.enum(["up", "down"]),
});
type Input = z.infer<typeof inputSchema>;
type VariantOutput = ReturnType<typeof toVariantOutput>;

export const handler: Handler<Input, VariantOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  try {
    const row = await withTenantScope(ctx.db, tenantId, async (db) => {
      const current = await getVariant(db, input.id);
      if (!current || current.archived_at) return null;

      const active = await listActiveVariantsForMenuItem(db, current.menu_item_id);
      const index = active.findIndex((item) => item.id === current.id);
      if (index < 0) return null;
      const neighbourIndex = input.direction === "up" ? index - 1 : index + 1;
      if (neighbourIndex < 0 || neighbourIndex >= active.length) return current;

      const neighbour = active[neighbourIndex]!;
      const currentOrder = current.sort_order;
      const neighbourOrder = neighbour.sort_order;
      const temp = Math.max(...active.map((item) => item.sort_order), 0) + 1000;
      await setVariantSortOrder(db, current.id, temp);
      await setVariantSortOrder(db, neighbour.id, currentOrder);
      return setVariantSortOrder(db, current.id, neighbourOrder);
    });
    return row ? toVariantOutput(row) : null;
  } catch {
    return null;
  }
};
