import { catalogMenuItemSetPriceInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { updateMenuItemPrice } from "../db-operations/commands/update-menu-item-price.command.ts";
import { getMenuItem } from "../db-operations/queries/get-menu-item.query.ts";
import { toMenuItemOutput } from "../helpers.ts";

export const inputSchema = catalogMenuItemSetPriceInputSchema;
type Input = z.infer<typeof inputSchema>;
type MenuItemOutput = ReturnType<typeof toMenuItemOutput>;

export const handler: Handler<Input, MenuItemOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  const row = await withTenantScope(ctx.db, tenantId, async (db) => {
    const current = await getMenuItem(db, input.id);
    if (!current || current.archived_at) return null;
    if (current.price_centavos === input.priceCentavos) return current;
    const updated = await updateMenuItemPrice(db, input.id, input.priceCentavos);
    return updated ? getMenuItem(db, updated.id) : undefined;
  });
  return row ? toMenuItemOutput(row) : null;
};
