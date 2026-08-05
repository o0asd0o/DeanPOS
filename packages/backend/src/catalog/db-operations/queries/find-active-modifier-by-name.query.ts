import type { DatabaseInstance } from "../../../db/client.ts";

export const findActiveModifierByName = (db: DatabaseInstance, groupId: string, name: string) =>
  db
    .selectFrom("Modifier")
    .selectAll()
    .where("group_id", "=", groupId)
    .where("name", "=", name)
    .where("archived_at", "is", null)
    .executeTakeFirst();
