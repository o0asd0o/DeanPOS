import type { DatabaseInstance } from "../../../db/client.ts";

export const getPaymentMethodAvailabilityStoreIds = async (
  db: DatabaseInstance,
  paymentMethodId: string,
): Promise<string[]> => {
  const rows = await db
    .selectFrom("PaymentMethodAvailability")
    .select("store_id")
    .where("payment_method_id", "=", paymentMethodId)
    .execute();
  return rows.map((row) => row.store_id);
};
