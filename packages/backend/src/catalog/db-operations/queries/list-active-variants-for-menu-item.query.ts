import type { DatabaseInstance } from "../../../db/client.ts";

export const listActiveVariantsForMenuItem = (db: DatabaseInstance, menuItemId: string) =>
  db
    .selectFrom("Variant")
    .selectAll()
    .where("menu_item_id", "=", menuItemId)
    .where("archived_at", "is", null)
    .orderBy("sort_order")
    .orderBy("id")
    .execute();
