import { sql } from "kysely";

import type { DatabaseInstance } from "../../../db/client.ts";

export const listModifierGroups = (db: DatabaseInstance) =>
  db
    .selectFrom("ModifierGroup")
    .selectAll("ModifierGroup")
    .select(
      sql<number>`(
        SELECT COUNT(*)::int
        FROM "MenuItemModifierGroup" immg
        JOIN "MenuItem" mi ON mi.tenant_id = immg.tenant_id AND mi.id = immg.menu_item_id
        WHERE immg.modifier_group_id = "ModifierGroup".id
          AND mi.archived_at IS NULL
      )`.as("linked_to_count"),
    )
    .orderBy("sort_order")
    .orderBy("id")
    .execute();
