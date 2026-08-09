import type { DatabaseInstance } from "../../../db/client.ts";
export const setAddOnArchived = (db: DatabaseInstance, id: string, archivedAt: Date | null) =>
  db
    .updateTable("AddOn")
    .set({ archived_at: archivedAt })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
