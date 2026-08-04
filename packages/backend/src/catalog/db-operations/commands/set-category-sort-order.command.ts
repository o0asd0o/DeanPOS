import type { DatabaseInstance } from "../../../db/client.ts";

export const setCategorySortOrder = (db: DatabaseInstance, id: string, sortOrder: number) =>
  db
    .updateTable("Category")
    .set({ sort_order: sortOrder })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
