import type { DatabaseInstance } from "../../../db/client.ts";

export const insertAddOn = (
  db: DatabaseInstance,
  values: {
    id: string;
    tenantId: string;
    name: string;
    deltaKind: string;
    deltaValue: number;
    maximum: number | null;
    sortOrder: number;
  },
) =>
  db
    .insertInto("AddOn")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      name: values.name,
      delta_kind: values.deltaKind,
      delta_value: values.deltaValue,
      maximum: values.maximum,
      sort_order: values.sortOrder,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
