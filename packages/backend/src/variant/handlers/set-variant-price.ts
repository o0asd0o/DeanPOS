import { catalogVariantSetPriceInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { updateVariantPrice } from "../db-operations/commands/update-variant-price.command.ts";
import { getVariant } from "../db-operations/queries/get-variant.query.ts";
import { toVariantOutput } from "../helpers.ts";

export const inputSchema = catalogVariantSetPriceInputSchema;
type Input = z.infer<typeof inputSchema>;
type VariantOutput = ReturnType<typeof toVariantOutput>;

export const handler: Handler<Input, VariantOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  const row = await withTenantScope(ctx.db, tenantId, async (db) => {
    const current = await getVariant(db, input.id);
    if (!current || current.archived_at) return null;
    if (current.price_centavos === input.priceCentavos) return current;
    return updateVariantPrice(db, input.id, input.priceCentavos);
  });
  return row ? toVariantOutput(row) : null;
};
