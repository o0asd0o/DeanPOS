import { sql } from "kysely";

import type { DatabaseInstance } from "../../../db/client.ts";

// Groups ordered by the library sort_order (decision 073 — no per-link sort column).
export const listLinkedModifierGroupsForItem = (db: DatabaseInstance, menuItemId: string) =>
  db
    .selectFrom("ModifierGroup")
    .selectAll("ModifierGroup")
    .select(
      sql<number>`(
        SELECT COUNT(*)::int
        FROM "MenuItemModifierGroup" immg2
        JOIN "MenuItem" mi ON mi.tenant_id = immg2.tenant_id AND mi.id = immg2.menu_item_id
        WHERE immg2.modifier_group_id = "ModifierGroup".id
          AND mi.archived_at IS NULL
      )`.as("linked_to_count"),
    )
    .innerJoin("MenuItemModifierGroup", "MenuItemModifierGroup.modifier_group_id", "ModifierGroup.id")
    .where("MenuItemModifierGroup.menu_item_id", "=", menuItemId)
    .orderBy("ModifierGroup.sort_order")
    .orderBy("ModifierGroup.id")
    .execute();

// Used by the archive cascade and the effective-price guard.
export const listLinkedItemIdsForGroup = (db: DatabaseInstance, modifierGroupId: string) =>
  db
    .selectFrom("MenuItemModifierGroup")
    .select("menu_item_id")
    .where("modifier_group_id", "=", modifierGroupId)
    .execute();
