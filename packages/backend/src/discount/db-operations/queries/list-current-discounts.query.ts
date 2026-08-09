import type { DatabaseInstance } from "../../../db/client.ts";

export const listCurrentDiscounts = (db: DatabaseInstance) =>
  db
    .selectFrom("Discount")
    .selectAll()
    .distinctOn("discount_id")
    .orderBy("discount_id")
    .orderBy("effective_from", "desc")
    .orderBy("created_at", "desc")
    .execute();
