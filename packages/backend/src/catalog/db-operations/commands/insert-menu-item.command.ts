import type { DatabaseInstance } from "../../../db/client.ts";

export const insertMenuItem = (
  db: DatabaseInstance,
  values: {
    id: string;
    tenantId: string;
    categoryId: string;
    name: string;
    priceCentavos: number;
    sortOrder: number;
  },
) =>
  db
    .insertInto("MenuItem")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      category_id: values.categoryId,
      name: values.name,
      price_centavos: values.priceCentavos,
      sort_order: values.sortOrder,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
