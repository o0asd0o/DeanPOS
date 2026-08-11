import type { DatabaseTransaction } from "../../../db/client.ts";

export const getOrderById = (db: DatabaseTransaction, id: string) =>
  db
    .selectFrom("Order as order")
    .innerJoin("Payment as payment", (join) =>
      join
        .onRef("payment.tenant_id", "=", "order.tenant_id")
        .onRef("payment.order_id", "=", "order.id"),
    )
    .select(["order.id", "payment.change_centavos"])
    .where("order.id", "=", id)
    .executeTakeFirst();
