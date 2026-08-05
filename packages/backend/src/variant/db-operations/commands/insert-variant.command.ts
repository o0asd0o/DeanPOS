import type { DatabaseInstance } from "../../../db/client.ts";

export const insertVariant = (
  db: DatabaseInstance,
  values: {
    id: string;
    tenantId: string;
    menuItemId: string;
    name: string;
    priceCentavos: number;
    sortOrder: number;
  },
) =>
  db
    .insertInto("Variant")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      menu_item_id: values.menuItemId,
      name: values.name,
      price_centavos: values.priceCentavos,
      sort_order: values.sortOrder,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
