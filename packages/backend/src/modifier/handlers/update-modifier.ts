import { catalogModifierUpdateInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { guardEffectivePriceForItem } from "../../catalog/guard-effective-price.ts";
import { listLinkedItemIdsForGroup } from "../../catalog/db-operations/queries/list-linked-modifier-groups-for-item.query.ts";
import { deltaToStored, validateDeltaConfig } from "../delta.ts";
import { updateModifier } from "../db-operations/commands/update-modifier.command.ts";
import { getModifier } from "../db-operations/queries/get-modifier.query.ts";
import { toModifierOutput } from "../helpers.ts";

export const inputSchema = catalogModifierUpdateInputSchema;
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
      const current = await getModifier(db, input.id);
      if (!current || current.archived_at) return null;
      const updated = await updateModifier(db, input.id, {
        name: input.name,
        deltaKind: stored.kind,
        deltaValue: stored.value,
      });
      if (!updated) return null;
      // Guard: check every Item linked to this modifier's group (direction 3).
      const links = await listLinkedItemIdsForGroup(db, current.group_id);
      for (const link of links) {
        await guardEffectivePriceForItem(db, link.menu_item_id);
      }
      return updated;
    });
    return row ? toModifierOutput(row) : null;
  } catch {
    return null;
  }
};
