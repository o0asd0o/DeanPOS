import type { DatabaseInstance } from "../../../db/client.ts";

export const updateModifier = (
  db: DatabaseInstance,
  id: string,
  values: {
    name: string;
    deltaKind: string;
    deltaValue: number;
  },
) =>
  db
    .updateTable("Modifier")
    .set({
      name: values.name,
      delta_kind: values.deltaKind,
      delta_value: values.deltaValue,
    })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
