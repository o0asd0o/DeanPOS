import type { DatabaseInstance } from "../../../db/client.ts";

export const setModifierArchived = (db: DatabaseInstance, id: string, archivedAt: Date | null) =>
  db
    .updateTable("Modifier")
    .set({ archived_at: archivedAt })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
