import { randomUUID } from "node:crypto";

import { catalogCategoryCreateInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertCategory } from "../db-operations/commands/insert-category.command.ts";
import { nextCategorySortOrder } from "../db-operations/queries/next-category-sort-order.query.ts";
import { toCategoryOutput } from "../helpers.ts";

export const inputSchema = catalogCategoryCreateInputSchema;
type Input = z.infer<typeof inputSchema>;
type CategoryOutput = ReturnType<typeof toCategoryOutput>;

export const handler: Handler<Input, CategoryOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  const row = await withTenantScope(ctx.db, tenantId, async (db) => {
    const sortOrder = await nextCategorySortOrder(db);
    return insertCategory(db, {
      id: randomUUID(),
      tenantId,
      name: input.name,
      sortOrder,
    });
  });
  return toCategoryOutput(row);
};
