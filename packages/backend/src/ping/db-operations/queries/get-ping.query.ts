import type { DatabaseInstance } from "../../../db/client.ts";

export const getPing = (db: DatabaseInstance) =>
  db.selectFrom("Ping").selectAll().orderBy("id", "asc").executeTakeFirstOrThrow();
