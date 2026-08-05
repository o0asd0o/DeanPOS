import type { DatabaseInstance } from "../../../db/client.ts";

export const insertVariantModifierGroup = (
  db: DatabaseInstance,
  id: string,
  tenantId: string,
  variantId: string,
  modifierGroupId: string,
) =>
  db
    .insertInto("VariantModifierGroup")
    .values({ id, tenant_id: tenantId, variant_id: variantId, modifier_group_id: modifierGroupId })
    .returningAll()
    .executeTakeFirst();
