import { sql } from "kysely";
import type { DatabaseInstance } from "../../../db/client.ts";

export const getAddOn = (db: DatabaseInstance, id: string) =>
  db
    .selectFrom("AddOn")
    .selectAll("AddOn")
    .select((eb) =>
      eb
        .selectFrom("MenuItemAddOn as imao")
        .innerJoin("MenuItem as mi", (join) =>
          join
            .onRef("mi.tenant_id", "=", "imao.tenant_id")
            .onRef("mi.id", "=", "imao.menu_item_id"),
        )
        .select(sql<number>`count(*)::int`.as("linked_to_count"))
        .whereRef("imao.add_on_id", "=", "AddOn.id")
        .where("mi.archived_at", "is", null)
        .as("linked_to_count"),
    )
    .where("id", "=", id)
    .executeTakeFirst();
