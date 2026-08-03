import type { DatabaseInstance } from "../../../db/client.ts";

// Deactivation and reactivation share this one column-only command — never
// the save procedure that moves name/availability (record 040 §3).
export const setPaymentMethodActive = (db: DatabaseInstance, id: string, active: boolean) =>
  db
    .updateTable("PaymentMethod")
    .set({ active })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
