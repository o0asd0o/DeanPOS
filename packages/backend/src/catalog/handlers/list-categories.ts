import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listCategories } from "../db-operations/queries/list-categories.query.ts";
import { toCategoryOutput } from "../helpers.ts";

type CategoryOutput = ReturnType<typeof toCategoryOutput>;

// BO list — manager+ (catalog route minRole).
export const handler: Handler<void, CategoryOutput[]> = async ({ ctx }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return [];
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return [];

  const rows = await withTenantScope(ctx.db, tenantId, (db) => listCategories(db));
  return rows.map(toCategoryOutput);
};
