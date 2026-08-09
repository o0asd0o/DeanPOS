import type { DatabaseInstance } from "../../../db/client.ts";
export const setAddOnSortOrder = (db: DatabaseInstance, id: string, sortOrder: number) =>
  db
    .updateTable("AddOn")
    .set({ sort_order: sortOrder })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
