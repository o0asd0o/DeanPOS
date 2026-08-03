import type { DatabaseInstance } from "../../../db/client.ts";

// Name only — never `active` (set-payment-method-active.command.ts's alone,
// record 040 §3).
export const updatePaymentMethodName = (db: DatabaseInstance, id: string, name: string) =>
  db
    .updateTable("PaymentMethod")
    .set({ name })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
