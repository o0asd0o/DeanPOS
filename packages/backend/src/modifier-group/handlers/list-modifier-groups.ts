import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listModifierGroups } from "../db-operations/queries/list-modifier-groups.query.ts";
import { listModifiersForGroup } from "../../modifier/db-operations/queries/list-modifiers-for-group.query.ts";
import { toModifierGroupOutput } from "../helpers.ts";
import { modifierGroupListInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

type Output = ReturnType<typeof toModifierGroupOutput>;
type Input = z.infer<typeof modifierGroupListInputSchema>;

export const handler: Handler<
  Input,
  {
    items: Output[];
    count: number;
    page: number;
    perPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  }
> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role)
    return {
      items: [],
      count: 0,
      page: 1,
      perPage: input.perPage,
      hasNextPage: false,
      hasPrevPage: false,
    };
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager"))
    return {
      items: [],
      count: 0,
      page: 1,
      perPage: input.perPage,
      hasNextPage: false,
      hasPrevPage: false,
    };

  return withTenantScope(ctx.db, tenantId, async (db) => {
    const page = await listModifierGroups(db, input);
    const items = await Promise.all(
      page.items.map(async (group) => {
        const modifiers = await listModifiersForGroup(db, group.id);
        return toModifierGroupOutput(group, modifiers, group.linked_to_count);
      }),
    );
    return { ...page, items };
  });
};
