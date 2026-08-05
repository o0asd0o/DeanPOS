import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setModifierSortOrder } from "../db-operations/commands/set-modifier-sort-order.command.ts";
import { getModifier } from "../db-operations/queries/get-modifier.query.ts";
import { listActiveModifiersForGroup } from "../db-operations/queries/list-modifiers-for-group.query.ts";
import { toModifierOutput } from "../helpers.ts";

export const inputSchema = z.object({
  id: z.string(),
  direction: z.enum(["up", "down"]),
});
type Input = z.infer<typeof inputSchema>;
type Output = ReturnType<typeof toModifierOutput>;

export const handler: Handler<Input, Output | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  try {
    const row = await withTenantScope(ctx.db, tenantId, async (db) => {
      const current = await getModifier(db, input.id);
      if (!current || current.archived_at) return null;

      const active = await listActiveModifiersForGroup(db, current.group_id);
      const index = active.findIndex((item) => item.id === current.id);
      if (index < 0) return null;
      const neighbourIndex = input.direction === "up" ? index - 1 : index + 1;
      if (neighbourIndex < 0 || neighbourIndex >= active.length) return current;

      const neighbour = active[neighbourIndex]!;
      const currentOrder = current.sort_order;
      const neighbourOrder = neighbour.sort_order;
      const temp = Math.max(...active.map((item) => item.sort_order), 0) + 1000;
      await setModifierSortOrder(db, current.id, temp);
      await setModifierSortOrder(db, neighbour.id, currentOrder);
      return setModifierSortOrder(db, current.id, neighbourOrder);
    });
    return row ? toModifierOutput(row) : null;
  } catch {
    return null;
  }
};
