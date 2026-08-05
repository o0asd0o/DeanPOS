import type { DatabaseInstance } from "../../../db/client.ts";

export const setModifierSortOrder = (db: DatabaseInstance, id: string, sortOrder: number) =>
  db
    .updateTable("Modifier")
    .set({ sort_order: sortOrder })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
