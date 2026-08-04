import type { DatabaseInstance } from "../../../db/client.ts";

export const listVariantsForMenuItem = (db: DatabaseInstance, menuItemId: string) =>
  db
    .selectFrom("Variant")
    .selectAll()
    .where("menu_item_id", "=", menuItemId)
    .orderBy("sort_order")
    .orderBy("id")
    .execute();
