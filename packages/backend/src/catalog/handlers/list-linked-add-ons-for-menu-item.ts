import { catalogListLinkedAddOnsForItemInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { toAddOnOutput } from "../../add-on/helpers.ts";
import { withTenantScope } from "../../db/client.ts";
import { listLinkedAddOnsForItem } from "../db-operations/queries/list-linked-add-ons-for-item.query.ts";
export const inputSchema = catalogListLinkedAddOnsForItemInputSchema;
type Input = z.infer<typeof inputSchema>;
export const handler: Handler<Input, ReturnType<typeof toAddOnOutput>[]> = async ({
  ctx,
  input,
}) => {
  if (
    ctx.kind !== "tenant" ||
    !ctx.principal.role ||
    !hasAtLeastRole(ctx.principal.role, "manager")
  )
    return [];
  return withTenantScope(ctx.db, ctx.principal.tenantId, async (db) =>
    (await listLinkedAddOnsForItem(db, input.menuItemId)).map((row) =>
      toAddOnOutput(row, row.linked_to_count),
    ),
  );
};
