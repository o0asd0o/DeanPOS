import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setModifierArchived } from "../db-operations/commands/set-modifier-archived.command.ts";
import { updateModifierGroup } from "../../modifier-group/db-operations/commands/update-modifier-group.command.ts";
import { getModifier } from "../db-operations/queries/get-modifier.query.ts";
import { getModifierGroup } from "../../modifier-group/db-operations/queries/get-modifier-group.query.ts";
import { toModifierOutput } from "../helpers.ts";

export const inputSchema = z.object({ id: z.string() });
type Input = z.infer<typeof inputSchema>;
type Output = ReturnType<typeof toModifierOutput>;

export const handler: Handler<Input, Output | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  try {
    const row = await withTenantScope(ctx.db, tenantId, async (db) => {
      const current = await getModifier(db, input.id);
      if (!current) return null;
      if (current.archived_at) return current;

      const group = await getModifierGroup(db, current.group_id);
      if (group?.default_modifier_id === current.id) {
        await updateModifierGroup(db, group.id, {
          name: group.name,
          selectionRule: group.selection_rule,
          maximum: group.maximum,
          defaultModifierId: null,
        });
      }

      return setModifierArchived(db, input.id, new Date());
    });
    return row ? toModifierOutput(row) : null;
  } catch {
    return null;
  }
};
