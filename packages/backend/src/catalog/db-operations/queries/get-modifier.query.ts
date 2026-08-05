import type { DatabaseInstance } from "../../../db/client.ts";

export const getModifier = (db: DatabaseInstance, id: string) =>
  db.selectFrom("Modifier").selectAll().where("id", "=", id).executeTakeFirst();
