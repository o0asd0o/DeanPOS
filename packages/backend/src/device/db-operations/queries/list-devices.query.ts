import { sql } from "kysely";
import type { Selectable, SqlBool } from "kysely";

import { executeWithOffsetPagination, type PageEnvelope } from "../../../common/pagination.ts";
import type { DatabaseInstance } from "../../../db/client.ts";
import type { Device } from "../../../db/prisma/generated/types.ts";

export type DeviceListSortKey = "name" | "store" | "assignedTo" | "lastSeen" | "status";

export type DeviceListInput = {
  // Optional to match the contract's zod defaults — orpc parses before the
  // handler runs, so the query defaults anything absent.
  page?: number;
  perPage?: number;
  health?: "all" | "online" | "stale" | "offline";
  storeId?: string;
  search?: string;
  sort?: { key: DeviceListSortKey; direction: "asc" | "desc" };
};

export type DeviceListOutput = PageEnvelope<Selectable<Device>> & {
  totalCount: number;
  activeCount: number;
};

// The fleet page (record 056 Q5) with its filters server-side, so a page is
// a page of the *filtered* set. Health mirrors the client's dot thresholds:
// green under 5 minutes, amber under an hour, grey after — and a revoked
// Device is grey (offline). Store and assignee names need the joins for both
// the search and the sort. The id tie-break keeps offset pages stable.
export const listDevices = async (
  db: DatabaseInstance,
  input: DeviceListInput,
): Promise<DeviceListOutput> => {
  const {
    page = 1,
    perPage = 10,
    health = "all",
    storeId,
    search,
    sort = { key: "name", direction: "asc" },
  } = input;

  let qb = db
    .selectFrom("Device")
    .selectAll("Device")
    .leftJoin("Store", (join) =>
      join
        .onRef("Store.tenant_id", "=", "Device.tenant_id")
        .onRef("Store.id", "=", "Device.store_id"),
    )
    .leftJoin("User", (join) =>
      join
        .onRef("User.tenant_id", "=", "Device.tenant_id")
        .onRef("User.id", "=", "Device.assigned_user_id"),
    );

  if (health === "online") {
    qb = qb.where(
      sql<SqlBool>`"Device"."revoked_at" IS NULL AND "Device"."last_seen_at" >= now() - interval '5 minutes'`,
    );
  } else if (health === "stale") {
    qb = qb.where(
      sql<SqlBool>`"Device"."revoked_at" IS NULL AND "Device"."last_seen_at" >= now() - interval '1 hour' AND "Device"."last_seen_at" < now() - interval '5 minutes'`,
    );
  } else if (health === "offline") {
    // The OR needs parens — unwrapped, SQL precedence would let a revoked
    // Device match without the rest of the AND chain (search, store).
    qb = qb.where(
      sql<SqlBool>`("Device"."revoked_at" IS NOT NULL OR "Device"."last_seen_at" < now() - interval '1 hour')`,
    );
  }

  if (storeId) qb = qb.where("Device.store_id", "=", storeId);

  if (search) {
    // Escape LIKE wildcards so a literal % or _ in the term stays literal.
    const like = `%${search.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
    qb = qb.where(sql<SqlBool>`(
      "Device"."name" ILIKE ${like} OR
      "Device"."code" ILIKE ${like} OR
      "Store"."name" ILIKE ${like} OR
      lower(coalesce("User"."first_name", '') || ' ' || coalesce("User"."last_name", '')) ILIKE ${like}
    )`);
  }

  // status asc puts a revoked Device last (revoked_at NULL sorts first) —
  // the same order the client's status column used.
  if (sort.key === "store") qb = qb.orderBy("Store.name", sort.direction);
  else if (sort.key === "assignedTo")
    qb = qb.orderBy(
      sql`lower(coalesce("User"."first_name", '') || ' ' || coalesce("User"."last_name", ''))`,
      sort.direction,
    );
  else if (sort.key === "lastSeen") qb = qb.orderBy("Device.last_seen_at", sort.direction);
  else if (sort.key === "status") qb = qb.orderBy("Device.revoked_at", sort.direction);
  else qb = qb.orderBy("Device.name", sort.direction);
  qb = qb.orderBy("Device.id", "asc");

  const envelope = await executeWithOffsetPagination(qb, { page, perPage });

  // The page headline ("N devices · M active") counts the whole fleet,
  // independent of the current filter — one aggregate alongside the page.
  const summary = await db
    .selectFrom("Device")
    .select([
      sql<number>`count(*)::int`.as("total"),
      sql<number>`count(*) FILTER (WHERE "revoked_at" IS NULL)::int`.as("active"),
    ])
    .executeTakeFirstOrThrow();

  return {
    ...envelope,
    totalCount: summary.total,
    activeCount: summary.active,
  };
};
