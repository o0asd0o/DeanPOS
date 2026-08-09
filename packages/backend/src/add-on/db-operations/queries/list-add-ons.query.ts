import { sql } from "kysely";
import type { DatabaseInstance } from "../../../db/client.ts";

export const listAddOns = (db: DatabaseInstance) =>
  db
    .selectFrom("AddOn")
    .selectAll("AddOn")
    .select(
      sql<number>`(
    SELECT COUNT(*)::int FROM "MenuItemAddOn" imao
    JOIN "MenuItem" mi ON mi.tenant_id = imao.tenant_id AND mi.id = imao.menu_item_id
    WHERE imao.add_on_id = "AddOn".id AND mi.archived_at IS NULL
  )`.as("linked_to_count"),
    )
    .orderBy("sort_order")
    .orderBy("id")
    .execute();
