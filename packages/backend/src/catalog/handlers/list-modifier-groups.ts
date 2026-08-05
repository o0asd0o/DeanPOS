import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listModifierGroups } from "../db-operations/queries/list-modifier-groups.query.ts";
import { listModifiersForGroup } from "../db-operations/queries/list-modifiers-for-group.query.ts";
import { toModifierGroupOutput } from "../helpers.ts";

type Output = ReturnType<typeof toModifierGroupOutput>;

export const handler: Handler<void, Output[]> = async ({ ctx }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return [];
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return [];

  return withTenantScope(ctx.db, tenantId, async (db) => {
    const groups = await listModifierGroups(db);
    return Promise.all(
      groups.map(async (group) => {
        const modifiers = await listModifiersForGroup(db, group.id);
        return toModifierGroupOutput(group, modifiers, group.linked_to_count);
      }),
    );
  });
};
