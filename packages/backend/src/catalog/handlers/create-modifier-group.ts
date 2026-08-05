import { randomUUID } from "node:crypto";

import { catalogModifierGroupCreateInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertModifierGroup } from "../db-operations/commands/insert-modifier-group.command.ts";
import { findActiveModifierGroupByName } from "../db-operations/queries/find-active-modifier-group-by-name.query.ts";
import { getModifierGroup } from "../db-operations/queries/get-modifier-group.query.ts";
import { nextModifierGroupSortOrder } from "../db-operations/queries/next-modifier-group-sort-order.query.ts";
import { toModifierGroupOutput } from "../helpers.ts";

export const inputSchema = catalogModifierGroupCreateInputSchema;
type Input = z.infer<typeof inputSchema>;
type Output = ReturnType<typeof toModifierGroupOutput>;

function normalizeMaximum(
  selectionRule: Input["selectionRule"],
  maximum: number | null | undefined,
) {
  if (selectionRule !== "many") return null;
  return maximum ?? null;
}

export const handler: Handler<Input, Output | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  const maximum = normalizeMaximum(input.selectionRule, input.maximum);
  // many + 0 is refused by DB CHECK; refuse early too so the client sees null.
  if (input.selectionRule === "many" && maximum === 0) return null;

  try {
    const row = await withTenantScope(ctx.db, tenantId, async (db) => {
      const existing = await findActiveModifierGroupByName(db, input.name);
      if (existing) {
        if (existing.selection_rule === input.selectionRule && existing.maximum === maximum) {
          return getModifierGroup(db, existing.id);
        }
        return null;
      }

      const sortOrder = await nextModifierGroupSortOrder(db);
      const inserted = await insertModifierGroup(db, {
        id: randomUUID(),
        tenantId,
        name: input.name,
        selectionRule: input.selectionRule,
        maximum,
        sortOrder,
      });
      return getModifierGroup(db, inserted.id);
    });
    return row ? toModifierGroupOutput(row, [], row.linked_to_count) : null;
  } catch {
    return null;
  }
};
