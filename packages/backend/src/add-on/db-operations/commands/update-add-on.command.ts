import type { DatabaseInstance } from "../../../db/client.ts";

export const updateAddOn = (
  db: DatabaseInstance,
  id: string,
  values: { name: string; deltaKind: string; deltaValue: number; maximum: number | null },
) =>
  db
    .updateTable("AddOn")
    .set({
      name: values.name,
      delta_kind: values.deltaKind,
      delta_value: values.deltaValue,
      maximum: values.maximum,
    })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
