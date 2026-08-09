import { sql } from "kysely";

import type { DatabaseInstance } from "../../../db/client.ts";

export const getModifierGroup = (db: DatabaseInstance, id: string) =>
  db
    .selectFrom("ModifierGroup")
    .selectAll("ModifierGroup")
    .select((eb) =>
      eb
        .selectFrom("MenuItemModifierGroup as immg")
        .innerJoin("MenuItem as mi", (join) =>
          join
            .onRef("mi.tenant_id", "=", "immg.tenant_id")
            .onRef("mi.id", "=", "immg.menu_item_id"),
        )
        .select(sql<number>`count(*)::int`.as("linked_to_count"))
        .whereRef("immg.modifier_group_id", "=", "ModifierGroup.id")
        .where("mi.archived_at", "is", null)
        .as("linked_to_count"),
    )
    .where("id", "=", id)
    .executeTakeFirst();
