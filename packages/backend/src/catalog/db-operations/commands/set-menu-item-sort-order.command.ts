import type { DatabaseInstance } from "../../../db/client.ts";

export const setMenuItemSortOrder = (db: DatabaseInstance, id: string, sortOrder: number) =>
  db
    .updateTable("MenuItem")
    .set({ sort_order: sortOrder })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
