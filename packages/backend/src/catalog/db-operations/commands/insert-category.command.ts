import type { DatabaseInstance } from "../../../db/client.ts";

export const insertCategory = (
  db: DatabaseInstance,
  values: { id: string; tenantId: string; name: string; sortOrder: number },
) =>
  db
    .insertInto("Category")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      name: values.name,
      sort_order: values.sortOrder,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
