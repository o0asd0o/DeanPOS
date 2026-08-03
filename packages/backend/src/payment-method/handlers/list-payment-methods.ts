import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listPaymentMethodAvailability } from "../db-operations/queries/list-payment-method-availability.query.ts";
import { listPaymentMethods } from "../db-operations/queries/list-payment-methods.query.ts";
import { toPaymentMethodOutput } from "../helpers.ts";

type PaymentMethodOutput = ReturnType<typeof toPaymentMethodOutput>;

// `admin` only, and the route itself refuses (record 054 §"Smaller calls" 1)
// — empty array for any non-admin or unauthenticated caller.
export const handler: Handler<void, PaymentMethodOutput[]> = async ({ ctx }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return [];
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return [];

  const { methods, availability } = await withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const [methods, availability] = await Promise.all([
      listPaymentMethods(scopedDb),
      listPaymentMethodAvailability(scopedDb),
    ]);
    return { methods, availability };
  });

  const storeIdsByMethod = new Map<string, string[]>();
  for (const row of availability) {
    const ids = storeIdsByMethod.get(row.payment_method_id) ?? [];
    ids.push(row.store_id);
    storeIdsByMethod.set(row.payment_method_id, ids);
  }

  return methods.map((method) =>
    toPaymentMethodOutput(method, storeIdsByMethod.get(method.id) ?? []),
  );
};
