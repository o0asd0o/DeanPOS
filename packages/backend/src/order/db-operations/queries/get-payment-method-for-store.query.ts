import type { DatabaseTransaction } from "../../../db/client.ts";
import { selectAvailablePaymentMethods } from "../../../payment-method/db-operations/queries/select-available-payment-methods.query.ts";

export const getPaymentMethodForStore = (
  db: DatabaseTransaction,
  values: { paymentMethodId: string; storeId: string },
) =>
  selectAvailablePaymentMethods(db, values.storeId)
    .select(["method.id", "method.name", "method.kind"])
    .where("method.id", "=", values.paymentMethodId)
    .executeTakeFirst();
