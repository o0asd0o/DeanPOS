import type { DatabaseInstance } from "../../../db/client.ts";
import { catalogVersion } from "../../../catalog/db-operations/queries/catalog-version.query.ts";
import { randomUUID } from "node:crypto";

export type SetAvailabilityInput = {
  tenantId: string;
  storeId: string;
  variantsOff: string[];
  variantsOn: string[];
  itemsOff: string[];
  itemsOn: string[];
};

export const setAvailability = async (
  db: DatabaseInstance,
  input: SetAvailabilityInput,
) => {
  if (input.variantsOn.length)
    await db
      .deleteFrom("VariantUnavailability")
      .where("store_id", "=", input.storeId)
      .where("variant_id", "in", input.variantsOn)
      .execute();
  if (input.variantsOff.length)
    await db
      .insertInto("VariantUnavailability")
      .values(
        (
          await db
            .selectFrom("Variant")
            .select(["tenant_id", "id"])
            .where("id", "in", input.variantsOff)
            .execute()
        ).map((row) => ({
          id: randomUUID(),
          tenant_id: row.tenant_id,
          variant_id: row.id,
          store_id: input.storeId,
        })),
      )
      .onConflict((oc) => oc.columns(["variant_id", "store_id"]).doNothing())
      .execute();
  if (input.itemsOn.length)
    await db
      .deleteFrom("MenuItemUnavailability")
      .where("store_id", "=", input.storeId)
      .where("menu_item_id", "in", input.itemsOn)
      .execute();
  if (input.itemsOff.length)
    await db
      .insertInto("MenuItemUnavailability")
      .values(
        (
          await db
            .selectFrom("MenuItem")
            .select(["tenant_id", "id"])
            .where("id", "in", input.itemsOff)
            .execute()
        ).map((row) => ({
          id: randomUUID(),
          tenant_id: row.tenant_id,
          menu_item_id: row.id,
          store_id: input.storeId,
        })),
      )
      .onConflict((oc) => oc.columns(["menu_item_id", "store_id"]).doNothing())
      .execute();

  return catalogVersion(db, input.tenantId, input.storeId);
};
