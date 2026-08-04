import type { DatabaseInstance } from "../../../db/client.ts";

export const listActiveMenuItemsInCategory = (db: DatabaseInstance, categoryId: string) =>
  db
    .selectFrom("MenuItem")
    .selectAll()
    .where("category_id", "=", categoryId)
    .where("archived_at", "is", null)
    .orderBy("sort_order")
    .orderBy("id")
    .execute();
