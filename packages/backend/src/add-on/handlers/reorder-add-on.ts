import { z } from "zod";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setAddOnSortOrder } from "../db-operations/commands/set-add-on-sort-order.command.ts";
import { getAddOn } from "../db-operations/queries/get-add-on.query.ts";
import { listActiveAddOns } from "../db-operations/queries/list-active-add-ons.query.ts";
import { toAddOnOutput } from "../helpers.ts";
export const inputSchema = z.object({ id: z.string(), direction: z.enum(["up", "down"]) });
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
      if (!current || current.archived_at) return null;
      const all = await listActiveAddOns(db);
      const index = all.findIndex((entry) => entry.id === input.id);
      const neighbour = all[input.direction === "up" ? index - 1 : index + 1];
      if (!neighbour) return toAddOnOutput(current, current.linked_to_count);
      const temporary = Math.max(...all.map((entry) => entry.sort_order), 0) + 1000;
      await setAddOnSortOrder(db, current.id, temporary);
      await setAddOnSortOrder(db, neighbour.id, current.sort_order);
      await setAddOnSortOrder(db, current.id, neighbour.sort_order);
      const updated = await getAddOn(db, current.id);
      return updated ? toAddOnOutput(updated, updated.linked_to_count) : null;
    });
  } catch {
    return null;
  }
};
