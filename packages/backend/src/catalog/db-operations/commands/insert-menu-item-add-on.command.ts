import type { DatabaseInstance } from "../../../db/client.ts";
export const insertMenuItemAddOn = (
  db: DatabaseInstance,
  id: string,
  tenantId: string,
  menuItemId: string,
  addOnId: string,
) =>
  db
    .insertInto("MenuItemAddOn")
    .values({ id, tenant_id: tenantId, menu_item_id: menuItemId, add_on_id: addOnId })
    .returningAll()
    .executeTakeFirst();
