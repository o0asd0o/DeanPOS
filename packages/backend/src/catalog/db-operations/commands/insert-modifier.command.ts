import type { DatabaseInstance } from "../../../db/client.ts";

export const insertModifier = (
  db: DatabaseInstance,
  values: {
    id: string;
    tenantId: string;
    groupId: string;
    name: string;
    deltaKind: string;
    deltaValue: number;
    sortOrder: number;
  },
) =>
  db
    .insertInto("Modifier")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      group_id: values.groupId,
      name: values.name,
      delta_kind: values.deltaKind,
      delta_value: values.deltaValue,
      sort_order: values.sortOrder,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
