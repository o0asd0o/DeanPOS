import { z } from "zod";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { deleteAllMenuItemLinksForAddOn } from "../../catalog/db-operations/commands/delete-menu-item-add-on.command.ts";
import { withTenantScope } from "../../db/client.ts";
import { setAddOnArchived } from "../db-operations/commands/set-add-on-archived.command.ts";
import { getAddOn } from "../db-operations/queries/get-add-on.query.ts";
import { toAddOnOutput } from "../helpers.ts";
export const inputSchema = z.object({ id: z.string() });
type Input = z.infer<typeof inputSchema>;
type Output = ReturnType<typeof toAddOnOutput>;
export const handler: Handler<Input, Output | null> = async ({ ctx, input }) => {
  if (
    ctx.kind !== "tenant" ||
    !ctx.principal.role ||
    !hasAtLeastRole(ctx.principal.role, "manager")
  )
    return null;
  try {
    return await withTenantScope(ctx.db, ctx.principal.tenantId, async (db) => {
      const current = await getAddOn(db, input.id);
      if (!current) return null;
      if (!current.archived_at) {
        await deleteAllMenuItemLinksForAddOn(db, input.id);
        await setAddOnArchived(db, input.id, new Date());
      }
      const row = await getAddOn(db, input.id);
      return row ? toAddOnOutput(row, row.linked_to_count) : null;
    });
  } catch {
    return null;
  }
};
