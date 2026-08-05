import { catalogVariantModifierGroupInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getVariant } from "../../variant/db-operations/queries/get-variant.query.ts";
import { getModifierGroup } from "../../modifier-group/db-operations/queries/get-modifier-group.query.ts";
import { deleteVariantModifierGroup } from "../db-operations/commands/delete-variant-modifier-group.command.ts";

export const inputSchema = catalogVariantModifierGroupInputSchema;
type Input = z.infer<typeof inputSchema>;

export const handler: Handler<Input, { ok: boolean }> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return { ok: false };
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return { ok: false };

  try {
    return await withTenantScope(ctx.db, tenantId, async (db) => {
      const variant = await getVariant(db, input.variantId);
      if (!variant) return { ok: false };

      const group = await getModifierGroup(db, input.modifierGroupId);
      if (!group) return { ok: false };

      await deleteVariantModifierGroup(db, input.variantId, input.modifierGroupId);
      return { ok: true };
    });
  } catch {
    return { ok: false };
  }
};
