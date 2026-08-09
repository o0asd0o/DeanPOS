import type { DatabaseInstance } from "../../../db/client.ts";

export const findCurrentActiveDiscountByName = (
  db: DatabaseInstance,
  name: string,
  excludedDiscountId: string,
) => {
  const current = db
    .selectFrom("Discount")
    .selectAll()
    .distinctOn("discount_id")
    .orderBy("discount_id")
    .orderBy("effective_from", "desc")
    .orderBy("created_at", "desc");

  return db
    .selectFrom(current.as("current"))
    .selectAll()
    .where("current.name", "=", name)
    .where("current.archived_at", "is", null)
    .where("current.discount_id", "<>", excludedDiscountId)
    .limit(1)
    .executeTakeFirst();
};
