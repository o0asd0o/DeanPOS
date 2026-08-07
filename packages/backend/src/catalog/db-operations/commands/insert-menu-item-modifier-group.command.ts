import type { DatabaseInstance } from "../../../db/client.ts";

export const insertMenuItemModifierGroup = (
  db: DatabaseInstance,
  id: string,
  tenantId: string,
  menuItemId: string,
  modifierGroupId: string,
) =>
  db
    .insertInto("MenuItemModifierGroup")
    .values({ id, tenant_id: tenantId, menu_item_id: menuItemId, modifier_group_id: modifierGroupId })
    .returningAll()
    .executeTakeFirst();
