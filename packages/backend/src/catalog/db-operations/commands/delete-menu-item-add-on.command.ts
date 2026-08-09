import type { DatabaseInstance } from "../../../db/client.ts";
export const deleteMenuItemAddOn = (db: DatabaseInstance, menuItemId: string, addOnId: string) =>
  db
    .deleteFrom("MenuItemAddOn")
    .where("menu_item_id", "=", menuItemId)
    .where("add_on_id", "=", addOnId)
    .returningAll()
    .executeTakeFirst();
export const deleteAllMenuItemLinksForAddOn = (db: DatabaseInstance, addOnId: string) =>
  db.deleteFrom("MenuItemAddOn").where("add_on_id", "=", addOnId).returningAll().execute();
