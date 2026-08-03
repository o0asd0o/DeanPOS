import type { DatabaseInstance } from "../../../db/client.ts";

export const getPaymentMethod = (db: DatabaseInstance, id: string) =>
  db.selectFrom("PaymentMethod").selectAll().where("id", "=", id).executeTakeFirst();
