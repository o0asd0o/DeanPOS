import type { DatabaseInstance } from "../../../db/client.ts";

export const getVariant = (db: DatabaseInstance, id: string) =>
  db.selectFrom("Variant").selectAll().where("id", "=", id).executeTakeFirst();
