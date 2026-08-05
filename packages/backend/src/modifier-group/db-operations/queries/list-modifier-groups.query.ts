import { sql } from "kysely";

import type { DatabaseInstance } from "../../../db/client.ts";

// ponytail: WHERE false → structural zero until issue 04 adds the linking table.
// Drop the false predicate and point the subselect at the real table then.
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
