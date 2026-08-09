import { catalogMenuItemAddOnInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { getAddOn } from "../../add-on/db-operations/queries/get-add-on.query.ts";
import { withTenantScope } from "../../db/client.ts";
import { deleteMenuItemAddOn } from "../db-operations/commands/delete-menu-item-add-on.command.ts";
import { getMenuItem } from "../db-operations/queries/get-menu-item.query.ts";
export const inputSchema = catalogMenuItemAddOnInputSchema;
type Input = z.infer<typeof inputSchema>;
export const handler: Handler<Input, { ok: boolean }> = async ({ ctx, input }) => {
  if (
    ctx.kind !== "tenant" ||
    !ctx.principal.role ||
    !hasAtLeastRole(ctx.principal.role, "manager")
  )
    return { ok: false };
  return withTenantScope(ctx.db, ctx.principal.tenantId, async (db) => {
    if (!(await getMenuItem(db, input.menuItemId)) || !(await getAddOn(db, input.addOnId)))
      return { ok: false };
    await deleteMenuItemAddOn(db, input.menuItemId, input.addOnId);
    return { ok: true };
  });
};
