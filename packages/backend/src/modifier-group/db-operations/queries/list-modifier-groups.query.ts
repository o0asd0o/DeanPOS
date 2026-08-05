import { sql } from "kysely";

import type { DatabaseInstance } from "../../../db/client.ts";

export const listModifierGroups = (db: DatabaseInstance) =>
  db
    .selectFrom("ModifierGroup")
    .selectAll("ModifierGroup")
    .select(
      sql<number>`(
        SELECT COUNT(*)::int
        FROM "VariantModifierGroup" vmg
        JOIN "Variant" v ON v.tenant_id = vmg.tenant_id AND v.id = vmg.variant_id
        WHERE vmg.modifier_group_id = "ModifierGroup".id
          AND v.archived_at IS NULL
      )`.as("linked_to_count"),
    )
    .orderBy("sort_order")
    .orderBy("id")
    .execute();
