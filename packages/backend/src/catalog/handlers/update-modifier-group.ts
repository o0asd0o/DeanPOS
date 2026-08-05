import { catalogModifierGroupUpdateInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { updateModifierGroup } from "../db-operations/commands/update-modifier-group.command.ts";
import { getModifier } from "../db-operations/queries/get-modifier.query.ts";
import { getModifierGroup } from "../db-operations/queries/get-modifier-group.query.ts";
import { listModifiersForGroup } from "../db-operations/queries/list-modifiers-for-group.query.ts";
import { toModifierGroupOutput } from "../helpers.ts";

export const inputSchema = catalogModifierGroupUpdateInputSchema;
type Input = z.infer<typeof inputSchema>;
type Output = ReturnType<typeof toModifierGroupOutput>;

function normalizeMaximum(
  selectionRule: Input["selectionRule"],
  maximum: number | null | undefined,
) {
  if (selectionRule !== "many") return null;
  return maximum === undefined ? null : maximum;
}

export const handler: Handler<Input, Output | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  const maximum = normalizeMaximum(input.selectionRule, input.maximum);
  if (input.selectionRule === "many" && maximum === 0) return null;

  try {
    const result = await withTenantScope(ctx.db, tenantId, async (db) => {
      const current = await getModifierGroup(db, input.id);
      if (!current || current.archived_at) return null;

      let defaultModifierId =
        input.defaultModifierId === undefined
          ? current.default_modifier_id
          : input.defaultModifierId;

      if (defaultModifierId) {
        const def = await getModifier(db, defaultModifierId);
        if (!def || def.group_id !== current.id || def.archived_at) return null;
      }

      await updateModifierGroup(db, input.id, {
        name: input.name,
        selectionRule: input.selectionRule,
        maximum,
        defaultModifierId,
      });

      const group = await getModifierGroup(db, input.id);
      if (!group) return null;
      const modifiers = await listModifiersForGroup(db, group.id);
      return toModifierGroupOutput(group, modifiers, group.linked_to_count);
    });
    return result;
  } catch {
    return null;
  }
};
