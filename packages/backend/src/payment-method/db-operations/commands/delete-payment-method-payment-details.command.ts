import type { DatabaseInstance } from "../../../db/client.ts";

// Clearing every field deletes the row rather than leaving an all-null one
// (issue 14) — a method with none set behaves byte-for-byte as it does today.
export const deletePaymentMethodPaymentDetails = (db: DatabaseInstance, id: string) =>
  db.deleteFrom("PaymentMethodPaymentDetails").where("id", "=", id).execute();
