import { sql } from "kysely";
import type { SqlBool } from "kysely";

import { executeWithOffsetPagination, type PageEnvelope } from "../../../common/pagination.ts";
import type { DatabaseInstance } from "../../../db/client.ts";
import type { User } from "../../../db/prisma/generated/types.ts";

export type StoreListInput = {
  page?: number;
  perPage?: number;
  status?: "all" | "active" | "deactivated";
  search?: string;
  sort?: { key: "name" | "businessDayStart" | "tableLabels" | "status"; direction: "asc" | "desc" };
  callerRole: User["role"];
  callerStoreIds: string[];
};

type StoreRow = {
  id: string;
  tenant_id: string;
  name: string;
  business_day_start: string;
  table_labels: string[];
  active: boolean;
  createdAt: Date;
};

export type StoreListOutput = PageEnvelope<StoreRow> & { totalCount: number; activeCount: number };

export const listStores = async (
  db: DatabaseInstance,
  input: StoreListInput,
): Promise<StoreListOutput> => {
  const {
    page = 1,
    perPage = 10,
    status = "all",
    search,
    sort = { key: "name", direction: "asc" },
    callerRole,
    callerStoreIds,
  } = input;
  const manager = callerRole === "manager";
  let qb = db.selectFrom("Store").selectAll();
  if (manager) qb = qb.where("Store.id", "in", callerStoreIds);
  if (status === "active") qb = qb.where("Store.active", "=", true);
  if (status === "deactivated") qb = qb.where("Store.active", "=", false);
  if (search) {
    const like = `%${search.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
    qb = qb.where(sql<SqlBool>`("Store"."name" ILIKE ${like} OR EXISTS (
      SELECT 1 FROM unnest("Store"."table_labels") label WHERE label ILIKE ${like}
    ))`);
  }
  if (sort.key === "name") qb = qb.orderBy(sql`lower("Store"."name")`, sort.direction);
  else if (sort.key === "businessDayStart")
    qb = qb.orderBy("Store.business_day_start", sort.direction);
  else if (sort.key === "tableLabels")
    qb = qb.orderBy(sql`cardinality("Store"."table_labels")`, sort.direction);
  else qb = qb.orderBy("Store.active", sort.direction === "asc" ? "desc" : "asc");
  qb = qb.orderBy("Store.id", "asc");
  const envelope = await executeWithOffsetPagination(qb, { page, perPage });
  let summaryQb = db
    .selectFrom("Store")
    .select([
      sql<number>`count(*)::int`.as("total"),
      sql<number>`count(*) FILTER (WHERE "active")::int`.as("active"),
    ]);
  if (manager) summaryQb = summaryQb.where("Store.id", "in", callerStoreIds);
  const summary = await summaryQb.executeTakeFirstOrThrow();
  return { ...envelope, totalCount: summary.total, activeCount: summary.active };
};
