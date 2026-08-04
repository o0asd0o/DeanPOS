import { sql } from "../../../db/client.ts";
import type { DatabaseInstance } from "../../../db/client.ts";

export const nextCategorySortOrder = async (db: DatabaseInstance) => {
  const result = await sql<{ sortOrder: number }>`
    select coalesce(max("sort_order"), -1) + 1 as "sortOrder" from "Category"
    where "archived_at" is null
  `.execute(db);
  return result.rows[0]!.sortOrder;
};
