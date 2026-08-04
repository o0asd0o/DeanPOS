import type { DatabaseInstance } from "../../../db/client.ts";

export const getMenuItem = (db: DatabaseInstance, id: string) =>
  db.selectFrom("MenuItem").selectAll().where("id", "=", id).executeTakeFirst();
