import type { DatabaseInstance } from "../../../db/client.ts";

export const getCategory = (db: DatabaseInstance, id: string) =>
  db.selectFrom("Category").selectAll().where("id", "=", id).executeTakeFirst();
