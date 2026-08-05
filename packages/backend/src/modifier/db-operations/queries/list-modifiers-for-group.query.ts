import type { DatabaseInstance } from "../../../db/client.ts";

export const listModifiersForGroup = (db: DatabaseInstance, groupId: string) =>
  db
    .selectFrom("Modifier")
    .selectAll()
    .where("group_id", "=", groupId)
    .orderBy("sort_order")
    .orderBy("id")
    .execute();

export const listActiveModifiersForGroup = (db: DatabaseInstance, groupId: string) =>
  db
    .selectFrom("Modifier")
    .selectAll()
    .where("group_id", "=", groupId)
    .where("archived_at", "is", null)
    .orderBy("sort_order")
    .orderBy("id")
    .execute();
