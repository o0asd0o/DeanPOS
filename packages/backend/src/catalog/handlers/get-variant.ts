import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getVariant } from "../db-operations/queries/get-variant.query.ts";
import { toVariantOutput } from "../helpers.ts";

export const inputSchema = z.object({ id: z.string() });
type Input = z.infer<typeof inputSchema>;
type VariantOutput = ReturnType<typeof toVariantOutput>;

export const handler: Handler<Input, VariantOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  const row = await withTenantScope(ctx.db, tenantId, (db) => getVariant(db, input.id));
  return row ? toVariantOutput(row) : null;
};
