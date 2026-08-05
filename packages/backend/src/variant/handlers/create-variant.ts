import { randomUUID } from "node:crypto";

import { catalogVariantCreateInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertVariant } from "../db-operations/commands/insert-variant.command.ts";
import { findActiveVariantByName } from "../db-operations/queries/find-active-variant-by-name.query.ts";
import { getMenuItem } from "../../catalog/db-operations/queries/get-menu-item.query.ts";
import { nextVariantSortOrder } from "../db-operations/queries/next-variant-sort-order.query.ts";
import { toVariantOutput } from "../helpers.ts";

export const inputSchema = catalogVariantCreateInputSchema;
type Input = z.infer<typeof inputSchema>;
type VariantOutput = ReturnType<typeof toVariantOutput>;

export const handler: Handler<Input, VariantOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  try {
    const row = await withTenantScope(ctx.db, tenantId, async (db) => {
      const menuItem = await getMenuItem(db, input.menuItemId);
      if (!menuItem || menuItem.archived_at) return null;

      // Idempotent create: identical Save returns the existing active row (scenario 24).
      const existing = await findActiveVariantByName(db, input.menuItemId, input.name);
      if (existing) {
        if (existing.price_centavos === input.priceCentavos) return existing;
        return null;
      }

      const sortOrder = await nextVariantSortOrder(db, input.menuItemId);
      return insertVariant(db, {
        id: randomUUID(),
        tenantId,
        menuItemId: input.menuItemId,
        name: input.name,
        priceCentavos: input.priceCentavos,
        sortOrder,
      });
    });
    return row ? toVariantOutput(row) : null;
  } catch {
    return null;
  }
};
