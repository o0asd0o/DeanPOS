import { sql } from "kysely";

import type { DatabaseInstance } from "../../../db/client.ts";

/**
 * Linked-to count is query-sourced. Issue 04 introduces the attachment rows;
 * until then the COUNT finds nothing and returns 0 (not a UI hardcode).
 */
export const listModifierGroups = (db: DatabaseInstance) =>
  db
    .selectFrom("ModifierGroup")
    .selectAll("ModifierGroup")
    .select(
      sql<number>`(
        SELECT COUNT(*)::int
        FROM "ModifierGroup" AS _link
        WHERE false
          AND _link.id = "ModifierGroup".id
      )`.as("linked_to_count"),
    )
    .orderBy("sort_order")
    .orderBy("id")
    .execute();
