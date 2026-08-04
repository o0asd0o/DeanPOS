import type { DatabaseInstance } from "../../../db/client.ts";

// One row: `storeId` null is the Tenant default. Resolution across the two
// levels (record 066 Q2/Q4) belongs to the caller — this reads exactly the
// row asked for, never both.
export const getPaymentMethodPaymentDetails = (
  db: DatabaseInstance,
  paymentMethodId: string,
  storeId: string | null,
) =>
  db
    .selectFrom("PaymentMethodPaymentDetails")
    .selectAll()
    .where("payment_method_id", "=", paymentMethodId)
    .where((eb) => (storeId === null ? eb("store_id", "is", null) : eb("store_id", "=", storeId)))
    .executeTakeFirst();
