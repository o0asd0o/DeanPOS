import type { DatabaseInstance } from "../../../db/client.ts";

export const renameDevice = (db: DatabaseInstance, id: string, name: string) =>
  db.updateTable("Device").set({ name }).where("id", "=", id).returningAll().executeTakeFirst();
