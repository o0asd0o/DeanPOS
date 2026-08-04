import { sql } from "../../../db/client.ts";
import type { DatabaseInstance } from "../../../db/client.ts";

export const nextMenuItemSortOrder = async (db: DatabaseInstance, categoryId: string) => {
  const result = await sql<{ sortOrder: number }>`
    select coalesce(max("sort_order"), -1) + 1 as "sortOrder" from "MenuItem"
    where "category_id" = ${categoryId} and "archived_at" is null
  `.execute(db);
  return result.rows[0]!.sortOrder;
};
