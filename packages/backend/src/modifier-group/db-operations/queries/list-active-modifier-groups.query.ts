import type { DatabaseInstance } from "../../../db/client.ts";

export const listActiveModifierGroups = (db: DatabaseInstance) =>
  db
    .selectFrom("ModifierGroup")
    .selectAll()
    .where("archived_at", "is", null)
    .orderBy("sort_order")
    .orderBy("id")
    .execute();
