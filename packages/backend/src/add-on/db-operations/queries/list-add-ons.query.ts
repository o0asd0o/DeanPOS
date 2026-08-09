import { sql } from "kysely";
import type { Selectable, SqlBool } from "kysely";
import type { DatabaseInstance } from "../../../db/client.ts";
import { executeWithOffsetPagination, type PageEnvelope } from "../../../common/pagination.ts";
import type { AddOn } from "../../../db/prisma/generated/types.ts";

export type AddOnListInput = {
  page?: number;
  perPage?: number;
  search?: string;
  usage?: "all" | "inuse" | "needsattention" | "unused";
  sort?: {
    key: "name" | "rule" | "delta" | "maximum" | "linked" | "status";
    direction: "asc" | "desc";
  };
};

type AddOnRow = Selectable<AddOn> & { linked_to_count: number };

export type AddOnListOutput = PageEnvelope<AddOnRow>;

export const listAddOns = async (
  db: DatabaseInstance,
  input: AddOnListInput = {},
): Promise<AddOnListOutput> => {
  const {
    page = 1,
    perPage = 10,
    search,
    usage = "all",
    sort = { key: "name", direction: "asc" },
  } = input;
  // Typed SQL remains necessary for this correlated aggregate projection.
  const linkedToCount = sql<number>`(
    SELECT COUNT(*)::int FROM "MenuItemAddOn" imao
    JOIN "MenuItem" mi ON mi.tenant_id = imao.tenant_id AND mi.id = imao.menu_item_id
    WHERE imao.add_on_id = "AddOn".id AND mi.archived_at IS NULL
  )`;
  let qb = db.selectFrom("AddOn").selectAll("AddOn").select(linkedToCount.as("linked_to_count"));

  if (search) {
    const like = `%${search.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
    qb = qb.where(sql<SqlBool>`"AddOn"."name" ILIKE ${like}`);
  }
  if (usage === "inuse") {
    qb = qb.where("AddOn.archived_at", "is", null).where(linkedToCount, ">", 0);
  } else if (usage === "needsattention") {
    qb = qb.where("AddOn.archived_at", "is not", null);
  } else if (usage === "unused") {
    qb = qb.where(linkedToCount, "=", 0);
  }

  if (sort.key === "delta") qb = qb.orderBy("AddOn.delta_kind", sort.direction);
  else if (sort.key === "maximum") qb = qb.orderBy("AddOn.maximum", sort.direction);
  else if (sort.key === "linked") qb = qb.orderBy(linkedToCount, sort.direction);
  else if (sort.key === "status") qb = qb.orderBy("AddOn.archived_at", sort.direction);
  else qb = qb.orderBy("AddOn.name", sort.direction);
  qb = qb.orderBy("AddOn.id", "asc");

  return executeWithOffsetPagination(qb, { page, perPage });
};
