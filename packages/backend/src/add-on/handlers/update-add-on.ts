import { catalogAddOnUpdateInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { listLinkedItemIdsForAddOn } from "../../catalog/db-operations/queries/list-linked-add-ons-for-item.query.ts";
import { guardEffectivePriceForItem } from "../../catalog/guard-effective-price.ts";
import { withTenantScope } from "../../db/client.ts";
import { deltaToStored, validateDeltaConfig } from "../../modifier/delta.ts";
import { updateAddOn } from "../db-operations/commands/update-add-on.command.ts";
import { getAddOn } from "../db-operations/queries/get-add-on.query.ts";
import { toAddOnOutput } from "../helpers.ts";

export const inputSchema = catalogAddOnUpdateInputSchema;
type Input = z.infer<typeof inputSchema>;
type Output = ReturnType<typeof toAddOnOutput>;
export const handler: Handler<Input, Output | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;
  const deltaResult = validateDeltaConfig(input.delta);
  if (!deltaResult.ok || input.maximum === 0) return null;
  const stored = deltaToStored(deltaResult.delta);
  try {
    const row = await withTenantScope(ctx.db, tenantId, async (db) => {
      const current = await getAddOn(db, input.id);
      if (!current || current.archived_at) return null;
      const updated = await updateAddOn(db, input.id, {
        name: input.name,
        deltaKind: stored.kind,
        deltaValue: stored.value,
        maximum: input.maximum ?? null,
      });
      if (!updated) return null;
      for (const link of await listLinkedItemIdsForAddOn(db, input.id))
        await guardEffectivePriceForItem(db, link.menu_item_id);
      return getAddOn(db, input.id);
    });
    return row ? toAddOnOutput(row, row.linked_to_count) : null;
  } catch {
    return null;
  }
};
