import type { DatabaseInstance } from "../../../db/client.ts";

export const nextModifierSortOrder = async (db: DatabaseInstance, groupId: string) => {
  const row = await db
    .selectFrom("Modifier")
    .select(({ fn }) => fn.max("sort_order").as("max"))
    .where("group_id", "=", groupId)
    .where("archived_at", "is", null)
    .executeTakeFirst();
  return (row?.max ?? -1) + 1;
};
