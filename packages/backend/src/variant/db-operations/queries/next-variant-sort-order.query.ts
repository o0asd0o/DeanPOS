import type { DatabaseInstance } from "../../../db/client.ts";

export const nextVariantSortOrder = async (db: DatabaseInstance, menuItemId: string) => {
  const row = await db
    .selectFrom("Variant")
    .select(({ fn }) => fn.max("sort_order").as("max"))
    .where("menu_item_id", "=", menuItemId)
    .where("archived_at", "is", null)
    .executeTakeFirst();
  return (row?.max ?? -1) + 1;
};
