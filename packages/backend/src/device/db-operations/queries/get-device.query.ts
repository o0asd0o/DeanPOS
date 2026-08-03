import type { DatabaseInstance } from "../../../db/client.ts";

export const getDevice = (db: DatabaseInstance, id: string) =>
  db.selectFrom("Device").selectAll().where("id", "=", id).executeTakeFirst();
