import { catalogListVariantsInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listVariantsForMenuItem } from "../db-operations/queries/list-variants-for-menu-item.query.ts";
import { toVariantOutput } from "../helpers.ts";

export const inputSchema = catalogListVariantsInputSchema;
type Input = z.infer<typeof inputSchema>;
type VariantOutput = ReturnType<typeof toVariantOutput>;

export const handler: Handler<Input, VariantOutput[]> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return [];
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return [];

  const rows = await withTenantScope(ctx.db, tenantId, (db) =>
    listVariantsForMenuItem(db, input.menuItemId),
  );
  return rows.map(toVariantOutput);
};
