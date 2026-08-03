import type { DatabaseInstance } from "../../../db/client.ts";

export const insertStore = (
  db: DatabaseInstance,
  values: {
    id: string;
    tenantId: string;
    name: string;
    businessDayStart: string;
    tableLabels: string[];
  },
) =>
  db
    .insertInto("Store")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      name: values.name,
      business_day_start: values.businessDayStart,
      table_labels: values.tableLabels,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
