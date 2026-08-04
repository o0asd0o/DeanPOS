import type { DatabaseInstance } from "../../../db/client.ts";

export const listMenuItems = (db: DatabaseInstance) =>
  db
    .selectFrom("MenuItem")
    .selectAll()
    .orderBy("category_id")
    .orderBy("sort_order")
    .orderBy("id")
    .execute();
