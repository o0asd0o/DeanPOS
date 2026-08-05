import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setModifierArchived } from "../db-operations/commands/set-modifier-archived.command.ts";
import { setModifierSortOrder } from "../db-operations/commands/set-modifier-sort-order.command.ts";
import { getModifier } from "../db-operations/queries/get-modifier.query.ts";
import { nextModifierSortOrder } from "../db-operations/queries/next-modifier-sort-order.query.ts";
import { toModifierOutput } from "../helpers.ts";

export const inputSchema = z.object({ id: z.string() });
type Input = z.infer<typeof inputSchema>;
type Output = ReturnType<typeof toModifierOutput>;

export const handler: Handler<Input, Output | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  try {
    const row = await withTenantScope(ctx.db, tenantId, async (db) => {
      const current = await getModifier(db, input.id);
      if (!current) return null;
      if (!current.archived_at) return current;
      const sortOrder = await nextModifierSortOrder(db, current.group_id);
      await setModifierSortOrder(db, input.id, sortOrder);
      return setModifierArchived(db, input.id, null);
    });
    return row ? toModifierOutput(row) : null;
  } catch {
    return null;
  }
};
