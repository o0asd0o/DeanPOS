import type { DatabaseInstance } from "../../../db/client.ts";
import { sql } from "../../../db/client.ts";

export const listMenuItems = (db: DatabaseInstance) =>
  db
    .selectFrom("MenuItem")
    .selectAll()
    .select(
      sql<number>`(
        select count(*)::int
        from "Variant"
        where "Variant"."menu_item_id" = "MenuItem"."id"
          and "Variant"."archived_at" is null
      )`.as("activeVariantCount"),
    )
    .orderBy("category_id")
    .orderBy("sort_order")
    .orderBy("id")
    .execute();
