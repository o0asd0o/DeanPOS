import type { DatabaseInstance } from "../db/client.ts";
import { getPaymentMethodPaymentDetails } from "./db-operations/queries/get-payment-method-payment-details.query.ts";

// `store_row ?? tenant_row`, the entire row, never field by field (issue 14
// criterion 2, record 066 Q2/Q4). `checkout` calls this rather than
// re-deriving the rule — a field-wise merge here is the bug it exists to catch.
export const resolvePaymentMethodPaymentDetails = async (
  db: DatabaseInstance,
  paymentMethodId: string,
  storeId: string | null,
) => {
  if (storeId !== null) {
    const storeRow = await getPaymentMethodPaymentDetails(db, paymentMethodId, storeId);
    if (storeRow) return storeRow;
  }
  return getPaymentMethodPaymentDetails(db, paymentMethodId, null);
};
