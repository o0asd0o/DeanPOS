import type { DatabaseInstance } from "../../../db/client.ts";

export const nextAddOnSortOrder = async (db: DatabaseInstance) => {
  const row = await db
    .selectFrom("AddOn")
    .select(({ fn }) => fn.max("sort_order").as("max"))
    .where("archived_at", "is", null)
    .executeTakeFirst();
  return (row?.max ?? -1) + 1;
};
