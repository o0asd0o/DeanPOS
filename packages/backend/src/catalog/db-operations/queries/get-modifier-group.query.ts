import { sql } from "kysely";

import type { DatabaseInstance } from "../../../db/client.ts";

export const getModifierGroup = (db: DatabaseInstance, id: string) =>
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
    .where("id", "=", id)
    .executeTakeFirst();
