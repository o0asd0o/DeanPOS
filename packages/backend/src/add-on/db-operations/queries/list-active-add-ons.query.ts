import type { DatabaseInstance } from "../../../db/client.ts";

export const listActiveAddOns = (db: DatabaseInstance) =>
  db
    .selectFrom("AddOn")
    .selectAll()
    .where("archived_at", "is", null)
    .orderBy("sort_order")
    .orderBy("id")
    .execute();
