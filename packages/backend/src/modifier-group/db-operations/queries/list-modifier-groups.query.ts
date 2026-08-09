import { sql, type Selectable, type SqlBool } from "kysely";

import type { DatabaseInstance } from "../../../db/client.ts";
import { executeWithOffsetPagination, type PageEnvelope } from "../../../common/pagination.ts";
import type { ModifierGroup } from "../../../db/prisma/generated/types.ts";

export type ModifierGroupListInput = {
  page?: number;
  perPage?: number;
  search?: string;
  usage?: "all" | "inuse" | "needsattention" | "unused";
  sort?: {
    key: "name" | "rule" | "delta" | "maximum" | "linked" | "status";
    direction: "asc" | "desc";
  };
};

type ModifierGroupRow = Selectable<ModifierGroup> & {
  linked_to_count: number;
  active_modifier_count: number;
};

export type ModifierGroupListOutput = PageEnvelope<ModifierGroupRow>;

export const listModifierGroups = async (
  db: DatabaseInstance,
  input: ModifierGroupListInput = {},
): Promise<ModifierGroupListOutput> => {
  const {
    page = 1,
    perPage = 10,
    search,
    usage = "all",
    sort = { key: "name", direction: "asc" },
  } = input;
  // Typed SQL remains necessary for correlated aggregate projections; Kysely
  // cannot express this scalar subquery without dropping to sql fragments.
  const linkedToCount = sql<number>`(
    SELECT COUNT(*)::int
    FROM "MenuItemModifierGroup" immg
    JOIN "MenuItem" mi ON mi.tenant_id = immg.tenant_id AND mi.id = immg.menu_item_id
    WHERE immg.modifier_group_id = "ModifierGroup".id
      AND mi.archived_at IS NULL
  )`;
  const activeModifierCount = sql<number>`(
    SELECT COUNT(*)::int
    FROM "Modifier" modifier
    WHERE modifier.group_id = "ModifierGroup".id
      AND modifier.archived_at IS NULL
  )`;
  let qb = db
    .selectFrom("ModifierGroup")
    .selectAll("ModifierGroup")
    .select([linkedToCount.as("linked_to_count"), activeModifierCount.as("active_modifier_count")]);

  if (search) {
    const like = `%${search.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
    qb = qb.where(
      sql<SqlBool>`("ModifierGroup"."name" ILIKE ${like} OR EXISTS (
        SELECT 1 FROM "Modifier" modifier_search
        WHERE modifier_search.group_id = "ModifierGroup".id
          AND modifier_search.name ILIKE ${like}
      ))`,
    );
  }
  if (usage === "inuse") {
    qb = qb
      .where("ModifierGroup.archived_at", "is", null)
      .where(linkedToCount, ">", 0)
      .where(
        sql<SqlBool>`NOT ("ModifierGroup"."selection_rule" = 'required-one' AND ${activeModifierCount} = 0)`,
      );
  } else if (usage === "needsattention") {
    qb = qb
      .where("ModifierGroup.archived_at", "is", null)
      .where(linkedToCount, ">", 0)
      .where("ModifierGroup.selection_rule", "=", "required-one")
      .where(activeModifierCount, "=", 0);
  } else if (usage === "unused") {
    qb = qb.where(linkedToCount, "=", 0);
  }

  if (sort.key === "rule") qb = qb.orderBy("ModifierGroup.selection_rule", sort.direction);
  else if (sort.key === "linked") qb = qb.orderBy(linkedToCount, sort.direction);
  else if (sort.key === "status") qb = qb.orderBy("ModifierGroup.archived_at", sort.direction);
  else qb = qb.orderBy("ModifierGroup.name", sort.direction);
  qb = qb.orderBy("ModifierGroup.id", "asc");

  return executeWithOffsetPagination(qb, { page, perPage });
};
