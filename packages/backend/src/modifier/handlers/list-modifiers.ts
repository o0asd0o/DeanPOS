import { catalogListModifiersInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getModifierGroup } from "../../modifier-group/db-operations/queries/get-modifier-group.query.ts";
import { listModifiersForGroupPage } from "../db-operations/queries/list-modifiers-for-group.query.ts";
import { toModifierOutput } from "../helpers.ts";

export const inputSchema = catalogListModifiersInputSchema;
type Input = z.infer<typeof inputSchema>;
type Output = ReturnType<typeof toModifierOutput>;

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
    const group = await getModifierGroup(db, input.groupId);
    if (!group)
      return {
        items: [],
        count: 0,
        page: 1,
        perPage: input.perPage,
        hasNextPage: false,
        hasPrevPage: false,
      };
    const page = await listModifiersForGroupPage(db, input.groupId, input.page, input.perPage);
    return { ...page, items: page.items.map(toModifierOutput) };
  });
};
