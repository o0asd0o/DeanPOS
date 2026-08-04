import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setCategoryArchived } from "../db-operations/commands/set-category-archived.command.ts";
import { toCategoryOutput } from "../helpers.ts";

// One row only — MenuItem exclusion is parent-chain, never written down the tree (issue 01).
export const inputSchema = z.object({ id: z.string() });
type Input = z.infer<typeof inputSchema>;
type CategoryOutput = ReturnType<typeof toCategoryOutput>;

export const handler: Handler<Input, CategoryOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  const row = await withTenantScope(ctx.db, tenantId, (db) =>
    setCategoryArchived(db, input.id, new Date()),
  );
  return row ? toCategoryOutput(row) : null;
};
