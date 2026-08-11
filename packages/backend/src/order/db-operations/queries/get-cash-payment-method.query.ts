import type { DatabaseTransaction } from "../../../db/client.ts";

export const getCashPaymentMethod = (db: DatabaseTransaction) =>
  db
    .selectFrom("PaymentMethod")
    .select("id")
    .where("kind", "=", "cash")
    .where("active", "=", true)
    .executeTakeFirst();
