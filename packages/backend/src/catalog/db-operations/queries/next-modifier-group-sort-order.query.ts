import type { DatabaseInstance } from "../../../db/client.ts";

export const nextModifierGroupSortOrder = async (db: DatabaseInstance) => {
  const row = await db
    .selectFrom("ModifierGroup")
    .select(({ fn }) => fn.max("sort_order").as("max"))
    .where("archived_at", "is", null)
    .executeTakeFirst();
  return (row?.max ?? -1) + 1;
};
