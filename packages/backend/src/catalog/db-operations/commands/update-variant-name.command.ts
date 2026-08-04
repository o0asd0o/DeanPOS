import type { DatabaseInstance } from "../../../db/client.ts";

export const updateVariantName = (db: DatabaseInstance, id: string, name: string) =>
  db
    .updateTable("Variant")
    .set({ name })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
