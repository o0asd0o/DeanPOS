import type { DatabaseInstance } from "../../../db/client.ts";

export const moveMenuItem = (
  db: DatabaseInstance,
  id: string,
  values: { categoryId: string; sortOrder: number },
) =>
  db
    .updateTable("MenuItem")
    .set({ category_id: values.categoryId, sort_order: values.sortOrder })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
