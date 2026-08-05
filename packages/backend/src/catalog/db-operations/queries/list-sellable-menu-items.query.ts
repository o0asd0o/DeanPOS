import type { DatabaseInstance } from "../../../db/client.ts";

// Sellable = MenuItem not archived, parent Category not archived, has at least one active Variant.
export const listSellableMenuItems = (db: DatabaseInstance) =>
  db
    .selectFrom("MenuItem as m")
    .innerJoin("Category as c", (join) =>
      join.onRef("c.id", "=", "m.category_id").onRef("c.tenant_id", "=", "m.tenant_id"),
    )
    .select(["m.id", "m.tenant_id", "m.category_id", "m.name", "m.price_centavos", "m.sort_order"])
    .where("m.archived_at", "is", null)
    .where("c.archived_at", "is", null)
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom("Variant as v")
          .select(eb.lit(1).as("one"))
          .whereRef("v.menu_item_id", "=", "m.id")
          .where("v.archived_at", "is", null),
      ),
    )
    .orderBy("c.sort_order")
    .orderBy("m.sort_order")
    .orderBy("m.id")
    .execute();
