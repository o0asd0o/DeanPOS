import type { DatabaseInstance } from "../../../db/client.ts";

export const listStoresByIds = (db: DatabaseInstance, ids: string[]) =>
  db.selectFrom("Store").selectAll().where("id", "in", ids).execute();
