import type { DatabaseInstance } from "../../../db/client.ts";

// Name, business-day start and the whole label array move together — the
// only shape in which label order is unambiguous (record 040 §3). Never
// touches `active`; that is set-store-active.command.ts's alone.
export const updateStore = (
  db: DatabaseInstance,
  id: string,
  values: { name: string; businessDayStart: string; tableLabels: string[] },
) =>
  db
    .updateTable("Store")
    .set({
      name: values.name,
      business_day_start: values.businessDayStart,
      table_labels: values.tableLabels,
    })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
