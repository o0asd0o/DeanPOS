import { randomUUID } from "node:crypto";

import { catalogModifierCreateInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { deltaToStored, validateDeltaConfig } from "../delta.ts";
import { insertModifier } from "../db-operations/commands/insert-modifier.command.ts";
import { findActiveModifierByName } from "../db-operations/queries/find-active-modifier-by-name.query.ts";
import { getModifierGroup } from "../../modifier-group/db-operations/queries/get-modifier-group.query.ts";
import { nextModifierSortOrder } from "../db-operations/queries/next-modifier-sort-order.query.ts";
import { toModifierOutput } from "../helpers.ts";

export const inputSchema = catalogModifierCreateInputSchema;
type Input = z.infer<typeof inputSchema>;
type Output = ReturnType<typeof toModifierOutput>;

export const handler: Handler<Input, Output | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  const deltaResult =
    input.delta.kind === "absolute"
      ? validateDeltaConfig({ kind: "absolute", amountCentavos: input.delta.amountCentavos })
      : validateDeltaConfig({ kind: "multiplier", perMille: input.delta.perMille });
  if (!deltaResult.ok) return null;
  const stored = deltaToStored(deltaResult.delta);

  try {
    const row = await withTenantScope(ctx.db, tenantId, async (db) => {
      const group = await getModifierGroup(db, input.groupId);
      if (!group || group.archived_at) return null;

      const existing = await findActiveModifierByName(db, input.groupId, input.name);
      if (existing) {
        if (existing.delta_kind === stored.kind && existing.delta_value === stored.value) {
          return existing;
        }
        return null;
      }

      const sortOrder = await nextModifierSortOrder(db, input.groupId);
      return insertModifier(db, {
        id: randomUUID(),
        tenantId,
        groupId: input.groupId,
        name: input.name,
        deltaKind: stored.kind,
        deltaValue: stored.value,
        sortOrder,
      });
    });
    return row ? toModifierOutput(row) : null;
  } catch {
    return null;
  }
};
