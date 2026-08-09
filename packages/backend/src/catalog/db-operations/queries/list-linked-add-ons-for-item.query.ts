import { sql } from "kysely";
import type { DatabaseInstance } from "../../../db/client.ts";

export const listLinkedAddOnsForItem = (db: DatabaseInstance, menuItemId: string) =>
  db
    .selectFrom("AddOn")
    .selectAll("AddOn")
    // Typed SQL remains necessary for this correlated count projection.
    .select(
      sql<number>`(SELECT COUNT(*)::int FROM "MenuItemAddOn" imao2 JOIN "MenuItem" mi ON mi.tenant_id = imao2.tenant_id AND mi.id = imao2.menu_item_id WHERE imao2.add_on_id = "AddOn".id AND mi.archived_at IS NULL)`.as(
        "linked_to_count",
      ),
    )
    .innerJoin("MenuItemAddOn", "MenuItemAddOn.add_on_id", "AddOn.id")
    .where("MenuItemAddOn.menu_item_id", "=", menuItemId)
    .orderBy("AddOn.sort_order")
    .orderBy("AddOn.id")
    .execute();
export const listLinkedItemIdsForAddOn = (db: DatabaseInstance, addOnId: string) =>
  db.selectFrom("MenuItemAddOn").select("menu_item_id").where("add_on_id", "=", addOnId).execute();
