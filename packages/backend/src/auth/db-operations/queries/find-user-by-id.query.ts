import type { DatabaseInstance } from "../../../db/client.ts";

export const findUserById = (db: DatabaseInstance, id: string) =>
  db.selectFrom("User").selectAll().where("id", "=", id).executeTakeFirst();
