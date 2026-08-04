import type { DatabaseInstance } from "../../../db/client.ts";

export const updateCategoryName = (db: DatabaseInstance, id: string, name: string) =>
  db.updateTable("Category").set({ name }).where("id", "=", id).returningAll().executeTakeFirst();
