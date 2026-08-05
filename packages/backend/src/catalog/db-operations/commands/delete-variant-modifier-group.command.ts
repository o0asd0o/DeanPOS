import type { DatabaseInstance } from "../../../db/client.ts";

export const deleteVariantModifierGroup = (
  db: DatabaseInstance,
  variantId: string,
  modifierGroupId: string,
) =>
  db
    .deleteFrom("VariantModifierGroup")
    .where("variant_id", "=", variantId)
    .where("modifier_group_id", "=", modifierGroupId)
    .returningAll()
    .executeTakeFirst();

export const deleteAllLinksForGroup = (db: DatabaseInstance, modifierGroupId: string) =>
  db
    .deleteFrom("VariantModifierGroup")
    .where("modifier_group_id", "=", modifierGroupId)
    .returningAll()
    .execute();
