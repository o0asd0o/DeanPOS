import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listAddOns } from "../db-operations/queries/list-add-ons.query.ts";
import { toAddOnOutput } from "../helpers.ts";
type Output = ReturnType<typeof toAddOnOutput>;
export const handler: Handler<void, Output[]> = async ({ ctx }) => {
  if (
    ctx.kind !== "tenant" ||
    !ctx.principal.role ||
    !hasAtLeastRole(ctx.principal.role, "manager")
  )
    return [];
  return withTenantScope(ctx.db, ctx.principal.tenantId, async (db) =>
    (await listAddOns(db)).map((row) => toAddOnOutput(row, row.linked_to_count)),
  );
};
