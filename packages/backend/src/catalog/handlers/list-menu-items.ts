import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listMenuItems } from "../db-operations/queries/list-menu-items.query.ts";
import { toMenuItemOutput } from "../helpers.ts";

type MenuItemOutput = ReturnType<typeof toMenuItemOutput>;

export const handler: Handler<void, MenuItemOutput[]> = async ({ ctx }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return [];
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return [];

  const rows = await withTenantScope(ctx.db, tenantId, (db) => listMenuItems(db));
  return rows.map(toMenuItemOutput);
};
