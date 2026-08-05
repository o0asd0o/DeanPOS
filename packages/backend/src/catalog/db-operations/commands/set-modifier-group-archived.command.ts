import type { DatabaseInstance } from "../../../db/client.ts";

export const setModifierGroupArchived = (db: DatabaseInstance, id: string, archivedAt: Date | null) =>
  db
    .updateTable("ModifierGroup")
    .set({ archived_at: archivedAt })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
