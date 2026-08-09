import type { DatabaseInstance } from "../../../db/client.ts";

export const findActiveAddOnByName = (db: DatabaseInstance, name: string) =>
  db
    .selectFrom("AddOn")
    .selectAll()
    .where("name", "=", name)
    .where("archived_at", "is", null)
    .executeTakeFirst();
