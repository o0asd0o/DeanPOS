import type { DatabaseInstance } from "../../../db/client.ts";
import { sql } from "../../../db/client.ts";
import type { SqlBool } from "kysely";
import type { Selectable } from "kysely";

import { executeWithOffsetPagination, type PageEnvelope } from "../../../common/pagination.ts";
import type { MenuItem } from "../../../db/prisma/generated/types.ts";

export type MenuItemListInput = {
  categoryId?: string;
  page?: number;
  perPage?: number;
  status?: "all" | "live" | "draft" | "archived";
  search?: string;
  sort?: { key: "name" | "price" | "sortOrder"; direction: "asc" | "desc" };
};

type MenuItemRow = Selectable<MenuItem> & { activeVariantCount: number };

export type MenuItemListOutput = PageEnvelope<MenuItemRow> & {
  totalCount: number;
  activeCount: number;
  liveCount: number;
};

export const listMenuItems = async (
  db: DatabaseInstance,
  input: MenuItemListInput,
): Promise<MenuItemListOutput> => {
  const {
    categoryId,
    page = 1,
    perPage = 10,
    status = "all",
    search,
    sort = { key: "sortOrder", direction: "asc" },
  } = input;
  const activeVariantCount = sql<number>`(
    select count(*)::int
    from "Variant"
    where "Variant"."menu_item_id" = "MenuItem"."id"
      and "Variant"."archived_at" is null
  )`;
  let qb = db
    .selectFrom("MenuItem")
    .selectAll()
    .select(activeVariantCount.as("activeVariantCount"));

  if (categoryId) qb = qb.where("MenuItem.category_id", "=", categoryId);
  if (status === "archived") qb = qb.where("MenuItem.archived_at", "is not", null);
  else if (status === "live")
    qb = qb.where("MenuItem.archived_at", "is", null).where(activeVariantCount, ">", 0);
  else if (status === "draft")
    qb = qb.where("MenuItem.archived_at", "is", null).where(activeVariantCount, "=", 0);
  if (search) {
    const like = `%${search.replace(/[\\\\%_]/g, (match) => `\\${match}`)}%`;
    qb = qb.where(sql<SqlBool>`"MenuItem"."name" ILIKE ${like}`);
  }

  if (sort.key === "name") qb = qb.orderBy("MenuItem.name", sort.direction);
  else if (sort.key === "price") qb = qb.orderBy("MenuItem.price_centavos", sort.direction);
  else qb = qb.orderBy("MenuItem.sort_order", sort.direction);
  qb = qb.orderBy("MenuItem.id", "asc");

  const envelope = await executeWithOffsetPagination(qb, { page, perPage });
  let summaryQb = db
    .selectFrom("MenuItem")
    .select([
      sql<number>`count(*)::int`.as("total"),
      sql<number>`count(*) FILTER (WHERE "archived_at" IS NULL)::int`.as("active"),
      sql<number>`count(*) FILTER (WHERE "archived_at" IS NULL AND EXISTS (
        select 1 from "Variant"
        where "Variant"."menu_item_id" = "MenuItem"."id"
          and "Variant"."archived_at" is null
      ))::int`.as("live"),
    ]);
  if (categoryId) summaryQb = summaryQb.where("MenuItem.category_id", "=", categoryId);
  const summary = await summaryQb.executeTakeFirstOrThrow();

  return {
    ...envelope,
    totalCount: summary.total,
    activeCount: summary.active,
    liveCount: summary.live,
  };
};
