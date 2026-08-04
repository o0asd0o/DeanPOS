import { catalogCategoryRenameInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { updateCategoryName } from "../db-operations/commands/update-category-name.command.ts";
import { toCategoryOutput } from "../helpers.ts";

export const inputSchema = catalogCategoryRenameInputSchema;
type Input = z.infer<typeof inputSchema>;
type CategoryOutput = ReturnType<typeof toCategoryOutput>;

export const handler: Handler<Input, CategoryOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  const row = await withTenantScope(ctx.db, tenantId, (db) =>
    updateCategoryName(db, input.id, input.name),
  );
  return row ? toCategoryOutput(row) : null;
};
