import type { DatabaseInstance } from "../../../db/client.ts";

// Current state only, no effective dating (record 054 §"Smaller calls" 2) —
// closing an availability pair removes the row, `PaymentMethodAudit` is the
// sole history.
export const deletePaymentMethodAvailability = (
  db: DatabaseInstance,
  paymentMethodId: string,
  storeId: string,
) =>
  db
    .deleteFrom("PaymentMethodAvailability")
    .where("payment_method_id", "=", paymentMethodId)
    .where("store_id", "=", storeId)
    .execute();
