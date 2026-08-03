import type { DatabaseInstance } from "../../../db/client.ts";

export const insertPaymentMethodAvailability = (
  db: DatabaseInstance,
  values: { id: string; tenantId: string; paymentMethodId: string; storeId: string },
) =>
  db
    .insertInto("PaymentMethodAvailability")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      payment_method_id: values.paymentMethodId,
      store_id: values.storeId,
    })
    .execute();
