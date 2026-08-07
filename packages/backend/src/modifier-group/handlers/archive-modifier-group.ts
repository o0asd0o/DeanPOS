import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setModifierGroupArchived } from "../db-operations/commands/set-modifier-group-archived.command.ts";
import { getModifierGroup } from "../db-operations/queries/get-modifier-group.query.ts";
import { listModifiersForGroup } from "../../modifier/db-operations/queries/list-modifiers-for-group.query.ts";
import { listLinkedItemIdsForGroup } from "../../catalog/db-operations/queries/list-linked-modifier-groups-for-item.query.ts";
import { deleteAllMenuItemLinksForGroup } from "../../catalog/db-operations/commands/delete-menu-item-modifier-group.command.ts";
import { setMenuItemArchived } from "../../catalog/db-operations/commands/set-menu-item-archived.command.ts";
import { toModifierGroupOutput } from "../helpers.ts";

export const inputSchema = z.object({ id: z.string() });
type Input = z.infer<typeof inputSchema>;
type Output = ReturnType<typeof toModifierGroupOutput>;

export const handler: Handler<Input, Output | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  try {
    return await withTenantScope(ctx.db, tenantId, async (db) => {
      const current = await getModifierGroup(db, input.id);
      if (!current) return null;
      if (current.archived_at) {
        const modifiers = await listModifiersForGroup(db, current.id);
        return toModifierGroupOutput(current, modifiers, current.linked_to_count);
      }

      // Archive cascade: remove all item links. If required-one, archive the linked Items too
      // (an Item with an unsatisfiable required group is not sellable — PRD cascade table).
      if (current.selection_rule === "required-one") {
        const links = await listLinkedItemIdsForGroup(db, input.id);
        for (const link of links) {
          await setMenuItemArchived(db, link.menu_item_id, new Date());
        }
      }
      await deleteAllMenuItemLinksForGroup(db, input.id);

      await setModifierGroupArchived(db, input.id, new Date());
      const group = await getModifierGroup(db, input.id);
      if (!group) return null;
      const modifiers = await listModifiersForGroup(db, group.id);
      return toModifierGroupOutput(group, modifiers, group.linked_to_count);
    });
  } catch {
    return null;
  }
};
