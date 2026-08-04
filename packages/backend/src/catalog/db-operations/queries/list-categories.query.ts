import type { DatabaseInstance } from "../../../db/client.ts";

export const listCategories = (db: DatabaseInstance) =>
  db.selectFrom("Category").selectAll().orderBy("sort_order").orderBy("id").execute();
