import type { DatabaseInstance } from "../../../db/client.ts";

export const findActiveVariantByName = (
  db: DatabaseInstance,
  menuItemId: string,
  name: string,
) =>
  db
    .selectFrom("Variant")
    .selectAll()
    .where("menu_item_id", "=", menuItemId)
    .where("name", "=", name)
    .where("archived_at", "is", null)
    .executeTakeFirst();
