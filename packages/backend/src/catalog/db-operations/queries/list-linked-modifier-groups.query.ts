import { sql } from "kysely";

import type { DatabaseInstance } from "../../../db/client.ts";

// Groups ordered by the library sort_order (decision 073 — no per-link sort column).
export const listLinkedModifierGroupsForVariant = (db: DatabaseInstance, variantId: string) =>
  db
    .selectFrom("ModifierGroup")
    .selectAll("ModifierGroup")
    .select(
      sql<number>`(
        SELECT COUNT(*)::int
        FROM "VariantModifierGroup" vmg2
        JOIN "Variant" v ON v.tenant_id = vmg2.tenant_id AND v.id = vmg2.variant_id
        WHERE vmg2.modifier_group_id = "ModifierGroup".id
          AND v.archived_at IS NULL
      )`.as("linked_to_count"),
    )
    .innerJoin(
      "VariantModifierGroup",
      "VariantModifierGroup.modifier_group_id",
      "ModifierGroup.id",
    )
    .where("VariantModifierGroup.variant_id", "=", variantId)
    .orderBy("ModifierGroup.sort_order")
    .orderBy("ModifierGroup.id")
    .execute();

// Used by the archive cascade and the effective-price guard.
export const listLinkedVariantIdsForGroup = (db: DatabaseInstance, modifierGroupId: string) =>
  db
    .selectFrom("VariantModifierGroup")
    .select("variant_id")
    .where("modifier_group_id", "=", modifierGroupId)
    .execute();
