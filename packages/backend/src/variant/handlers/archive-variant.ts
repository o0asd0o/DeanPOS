import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setVariantArchived } from "../db-operations/commands/set-variant-archived.command.ts";
import { getVariant } from "../db-operations/queries/get-variant.query.ts";
import { toVariantOutput } from "../helpers.ts";

export const inputSchema = z.object({ id: z.string() });
type Input = z.infer<typeof inputSchema>;
type VariantOutput = ReturnType<typeof toVariantOutput>;

export const handler: Handler<Input, VariantOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  const row = await withTenantScope(ctx.db, tenantId, async (db) => {
    const current = await getVariant(db, input.id);
    if (!current) return null;
    if (current.archived_at) return current;
    return setVariantArchived(db, input.id, new Date());
  });
  return row ? toVariantOutput(row) : null;
};
