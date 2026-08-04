import type { DatabaseInstance } from "../../../db/client.ts";

export const listActiveCategories = (db: DatabaseInstance) =>
  db
    .selectFrom("Category")
    .selectAll()
    .where("archived_at", "is", null)
    .orderBy("sort_order")
    .orderBy("id")
    .execute();
