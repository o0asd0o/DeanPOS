import type { DatabaseInstance } from "../../../db/client.ts";

export const setModifierGroupSortOrder = (db: DatabaseInstance, id: string, sortOrder: number) =>
  db
    .updateTable("ModifierGroup")
    .set({ sort_order: sortOrder })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
