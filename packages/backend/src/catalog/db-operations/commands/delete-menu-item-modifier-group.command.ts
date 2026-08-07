import type { DatabaseInstance } from "../../../db/client.ts";

export const deleteMenuItemModifierGroup = (
  db: DatabaseInstance,
  menuItemId: string,
  modifierGroupId: string,
) =>
  db
    .deleteFrom("MenuItemModifierGroup")
    .where("menu_item_id", "=", menuItemId)
    .where("modifier_group_id", "=", modifierGroupId)
    .returningAll()
    .executeTakeFirst();

export const deleteAllMenuItemLinksForGroup = (db: DatabaseInstance, modifierGroupId: string) =>
  db
    .deleteFrom("MenuItemModifierGroup")
    .where("modifier_group_id", "=", modifierGroupId)
    .returningAll()
    .execute();
