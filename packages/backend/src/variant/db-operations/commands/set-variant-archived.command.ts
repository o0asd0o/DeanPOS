import type { DatabaseInstance } from "../../../db/client.ts";

export const setVariantArchived = (db: DatabaseInstance, id: string, archivedAt: Date | null) =>
  db
    .updateTable("Variant")
    .set({ archived_at: archivedAt })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
