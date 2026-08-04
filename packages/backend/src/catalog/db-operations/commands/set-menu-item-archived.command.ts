import type { DatabaseInstance } from "../../../db/client.ts";

export const setMenuItemArchived = (db: DatabaseInstance, id: string, archivedAt: Date | null) =>
  db
    .updateTable("MenuItem")
    .set({ archived_at: archivedAt })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
