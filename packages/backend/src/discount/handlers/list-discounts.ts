import { z } from "zod";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listCurrentDiscounts } from "../db-operations/queries/list-current-discounts.query.ts";
import { getDiscountAvailabilityStoreIds } from "../db-operations/queries/get-discount-availability-store-ids.query.ts";
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
    return withTenantScope(ctx.db, ctx.principal.tenantId, async (db) =>
      Promise.all(
        (await listCurrentDiscounts(db)).map(async (discount) =>
          toDiscountOutput(discount, await getDiscountAvailabilityStoreIds(db, discount.id)),
        ),
      ),
    );
  } catch {
    return [];
  }
};
