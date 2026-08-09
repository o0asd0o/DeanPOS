import type { DatabaseInstance } from "../../../db/client.ts";
import { sql } from "../../../db/client.ts";

export const getMenuItem = (db: DatabaseInstance, id: string) =>
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
    .where("id", "=", id)
    .executeTakeFirst();
