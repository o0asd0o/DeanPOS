import type { DatabaseInstance } from "../../../db/client.ts";

export const updateMenuItemName = (db: DatabaseInstance, id: string, name: string) =>
  db.updateTable("MenuItem").set({ name }).where("id", "=", id).returningAll().executeTakeFirst();
