import { catalogListModifiersInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getModifierGroup } from "../../modifier-group/db-operations/queries/get-modifier-group.query.ts";
import { listModifiersForGroup } from "../db-operations/queries/list-modifiers-for-group.query.ts";
import { toModifierOutput } from "../helpers.ts";

export const inputSchema = catalogListModifiersInputSchema;
type Input = z.infer<typeof inputSchema>;
type Output = ReturnType<typeof toModifierOutput>;

export const handler: Handler<Input, Output[]> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return [];
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return [];

  return withTenantScope(ctx.db, tenantId, async (db) => {
    const group = await getModifierGroup(db, input.groupId);
    if (!group) return [];
    const rows = await listModifiersForGroup(db, input.groupId);
    return rows.map(toModifierOutput);
  });
};
