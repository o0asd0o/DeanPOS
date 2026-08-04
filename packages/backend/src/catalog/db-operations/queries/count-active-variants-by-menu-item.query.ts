import type { DatabaseInstance } from "../../../db/client.ts";

export const countActiveVariantsByMenuItem = async (
  db: DatabaseInstance,
  menuItemIds: readonly string[],
) => {
  if (menuItemIds.length === 0) return new Map<string, number>();
  const rows = await db
    .selectFrom("Variant")
    .select(["menu_item_id", ({ fn }) => fn.countAll<number>().as("count")])
    .where("menu_item_id", "in", [...menuItemIds])
    .where("archived_at", "is", null)
    .groupBy("menu_item_id")
    .execute();
  return new Map(rows.map((row) => [row.menu_item_id, Number(row.count)]));
};
