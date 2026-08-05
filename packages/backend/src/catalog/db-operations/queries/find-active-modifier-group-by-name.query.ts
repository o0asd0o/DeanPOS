import type { DatabaseInstance } from "../../../db/client.ts";

export const findActiveModifierGroupByName = (db: DatabaseInstance, name: string) =>
  db
    .selectFrom("ModifierGroup")
    .selectAll()
    .where("name", "=", name)
    .where("archived_at", "is", null)
    .executeTakeFirst();
