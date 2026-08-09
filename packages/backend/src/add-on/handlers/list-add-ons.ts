import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listAddOns } from "../db-operations/queries/list-add-ons.query.ts";
import { toAddOnOutput } from "../helpers.ts";
import { addOnListInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";
type Output = ReturnType<typeof toAddOnOutput>;
type Input = z.infer<typeof addOnListInputSchema>;
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
  if (
    ctx.kind !== "tenant" ||
    !ctx.principal.role ||
    !hasAtLeastRole(ctx.principal.role, "manager")
  )
    return {
      items: [],
      count: 0,
      page: 1,
      perPage: input.perPage,
      hasNextPage: false,
      hasPrevPage: false,
    };
  return withTenantScope(ctx.db, ctx.principal.tenantId, async (db) => {
    const page = await listAddOns(db, input);
    return {
      ...page,
      items: page.items.map((row) => toAddOnOutput(row, row.linked_to_count)),
    };
  });
};
