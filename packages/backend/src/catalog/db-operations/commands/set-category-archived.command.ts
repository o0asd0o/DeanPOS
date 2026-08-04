import type { DatabaseInstance } from "../../../db/client.ts";

export const setCategoryArchived = (db: DatabaseInstance, id: string, archivedAt: Date | null) =>
  db
    .updateTable("Category")
    .set({ archived_at: archivedAt })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
