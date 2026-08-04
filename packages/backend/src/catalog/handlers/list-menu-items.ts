import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { countActiveVariantsByMenuItem } from "../db-operations/queries/count-active-variants-by-menu-item.query.ts";
import { listMenuItems } from "../db-operations/queries/list-menu-items.query.ts";
import { toMenuItemOutput } from "../helpers.ts";

type MenuItemOutput = ReturnType<typeof toMenuItemOutput>;

export const handler: Handler<void, MenuItemOutput[]> = async ({ ctx }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return [];
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return [];

  return withTenantScope(ctx.db, tenantId, async (db) => {
    const rows = await listMenuItems(db);
    const counts = await countActiveVariantsByMenuItem(
      db,
      rows.map((row) => row.id),
    );
    return rows.map((row) => toMenuItemOutput(row, (counts.get(row.id) ?? 0) > 0));
  });
};
