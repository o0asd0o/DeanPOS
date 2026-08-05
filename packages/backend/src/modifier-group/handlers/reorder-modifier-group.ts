import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setModifierGroupSortOrder } from "../db-operations/commands/set-modifier-group-sort-order.command.ts";
import { getModifierGroup } from "../db-operations/queries/get-modifier-group.query.ts";
import { listActiveModifierGroups } from "../db-operations/queries/list-active-modifier-groups.query.ts";
import { listModifiersForGroup } from "../../modifier/db-operations/queries/list-modifiers-for-group.query.ts";
import { toModifierGroupOutput } from "../helpers.ts";

export const inputSchema = z.object({
  id: z.string(),
  direction: z.enum(["up", "down"]),
});
type Input = z.infer<typeof inputSchema>;
type Output = ReturnType<typeof toModifierGroupOutput>;

export const handler: Handler<Input, Output | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  try {
    return await withTenantScope(ctx.db, tenantId, async (db) => {
      const current = await getModifierGroup(db, input.id);
      if (!current || current.archived_at) return null;

      const active = await listActiveModifierGroups(db);
      const index = active.findIndex((item) => item.id === current.id);
      if (index < 0) return null;
      const neighbourIndex = input.direction === "up" ? index - 1 : index + 1;
      if (neighbourIndex < 0 || neighbourIndex >= active.length) {
        const modifiers = await listModifiersForGroup(db, current.id);
        const group = await getModifierGroup(db, current.id);
        return group ? toModifierGroupOutput(group, modifiers, group.linked_to_count) : null;
      }

      const neighbour = active[neighbourIndex]!;
      const currentOrder = current.sort_order;
      const neighbourOrder = neighbour.sort_order;
      const temp = Math.max(...active.map((item) => item.sort_order), 0) + 1000;
      await setModifierGroupSortOrder(db, current.id, temp);
      await setModifierGroupSortOrder(db, neighbour.id, currentOrder);
      await setModifierGroupSortOrder(db, current.id, neighbourOrder);

      const group = await getModifierGroup(db, current.id);
      if (!group) return null;
      const modifiers = await listModifiersForGroup(db, group.id);
      return toModifierGroupOutput(group, modifiers, group.linked_to_count);
    });
  } catch {
    return null;
  }
};
