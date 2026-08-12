import type { DatabaseInstance } from "../../../db/client.ts";

export const getDiscountAvailabilityStoreIds = async (
  db: DatabaseInstance,
  discountVersionId: string,
) =>
  (
    await db
      .selectFrom("DiscountAvailability")
      .select("store_id")
      .where("discount_version_id", "=", discountVersionId)
      .execute()
  ).map((row) => row.store_id);
