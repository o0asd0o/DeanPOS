import type { DatabaseInstance } from "../../../db/client.ts";

// Seeded once at provisioning (issue 08): every Tenant's only `kind: cash`
// row. The partial unique index refuses a second one, even concurrently.
export const insertCashPaymentMethod = (
  db: DatabaseInstance,
  values: { id: string; tenantId: string },
) =>
  db
    .insertInto("PaymentMethod")
    .values({ id: values.id, tenant_id: values.tenantId, name: "Cash", kind: "cash" })
    .execute();
