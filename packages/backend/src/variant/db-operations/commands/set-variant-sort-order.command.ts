import type { DatabaseInstance } from "../../../db/client.ts";

export const setVariantSortOrder = (db: DatabaseInstance, id: string, sortOrder: number) =>
  db
    .updateTable("Variant")
    .set({ sort_order: sortOrder })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
