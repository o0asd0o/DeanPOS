import type { DatabaseInstance } from "../../../db/client.ts";

export const insertDiscountAvailability = (
  db: DatabaseInstance,
  values: { id: string; tenantId: string; discountVersionId: string; storeId: string },
) =>
  db
    .insertInto("DiscountAvailability")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      discount_version_id: values.discountVersionId,
      store_id: values.storeId,
    })
    .execute();
