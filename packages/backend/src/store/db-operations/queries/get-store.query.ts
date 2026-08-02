import type { DatabaseInstance } from "../../../db/client.ts";

export const getStore = (db: DatabaseInstance, id: string) =>
  db.selectFrom("Store").selectAll().where("id", "=", id).executeTakeFirst();
