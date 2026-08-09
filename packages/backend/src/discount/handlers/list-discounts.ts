import { z } from "zod";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listCurrentDiscounts } from "../db-operations/queries/list-current-discounts.query.ts";
import { toDiscountOutput } from "../helpers.ts";

export const inputSchema = z.void();
export const handler: Handler<undefined, ReturnType<typeof toDiscountOutput>[]> = async ({
  ctx,
}) => {
  if (
    ctx.kind !== "tenant" ||
    !ctx.principal.role ||
    !hasAtLeastRole(ctx.principal.role, "manager")
  )
    return [];
  try {
    return (await withTenantScope(ctx.db, ctx.principal.tenantId, listCurrentDiscounts)).map(
      toDiscountOutput,
    );
  } catch {
    return [];
  }
};
