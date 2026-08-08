import { sql } from "kysely";
import type { SqlBool } from "kysely";

import { executeWithOffsetPagination, type PageEnvelope } from "../../../common/pagination.ts";
import type { DatabaseInstance } from "../../../db/client.ts";
import type { User } from "../../../db/prisma/generated/types.ts";

export type UserListSortKey = "name" | "email" | "role" | "status";

export type UserListInput = {
  // Optional to match the contract's zod defaults — orpc parses before the
  // handler runs, so the query defaults anything absent.
  page?: number;
  perPage?: number;
  role?: "all" | "cashier" | "manager" | "admin";
  storeId?: string;
  search?: string;
  sort?: { key: UserListSortKey; direction: "asc" | "desc" };
  // The caller's role and Store visibility, resolved once by the handler —
  // the SQL's visibility predicate and per-page projection mirror record
  // 044 §2 clause 3, so a manager's page never carries an invisible Store.
  callerRole: User["role"];
  callerUserId: string;
  callerStoreIds: string[];
  now: Date;
};

type UserRow = {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: User["role"];
  active: boolean;
  createdAt: Date;
};

export type UserListOutput = PageEnvelope<UserRow> & {
  totalCount: number;
  activeCount: number;
  // The page rows' current Store assignments — already projected through the
  // caller's visibility, so the handler only maps them onto the rows.
  storeIdsByUser: Map<string, string[]>;
};

// The assignment history's latest row per (user, store) on or before `now` —
// the same rule `getAssignedStoreIdsAsOf` applies in JS (issue 04's
// un-assign-writes-a-closing-row rule), expressed once as a CTE the filters
// below all reuse. `effective_from` sorts before `created_at` exactly as the
// JS helper orders, so backdated assignments keep their meaning.
const latestAssignment = (db: DatabaseInstance, now: Date) =>
  db
    .with("latest_assignment", (qb) =>
      qb
        .selectFrom("UserStore")
        .select(["user_id", "store_id", "assigned"])
        .where("effective_from", "<=", now)
        .distinctOn(["user_id", "store_id"])
        .orderBy("user_id")
        .orderBy("store_id")
        .orderBy("effective_from", "desc")
        .orderBy("created_at", "desc"),
    );

// The roster page (record 076 amends 044 §2) with its filters server-side, so
// a page is a page of the *filtered* set. A manager sees themselves plus
// Users sharing one of their own Stores, and every filter stays inside that
// visibility — filtering or searching an invisible Store matches nothing, and
// the disclosed counts cover only rows the caller can see. The id tie-break
// keeps offset pages stable.
export const listUsers = async (
  db: DatabaseInstance,
  input: UserListInput,
): Promise<UserListOutput> => {
  const {
    page = 1,
    perPage = 10,
    role = "all",
    storeId,
    search,
    sort = { key: "name", direction: "asc" },
    callerRole,
    callerUserId,
    callerStoreIds,
    now,
  } = input;
  const manager = callerRole === "manager";

  const visible = sql<SqlBool>`(
    "User"."id" = ${callerUserId} OR EXISTS (
      SELECT 1 FROM "latest_assignment" la
      WHERE la."user_id" = "User"."id" AND la."assigned" AND la."store_id" = ANY(${callerStoreIds})
    )
  )`;

  let qb = latestAssignment(db, now)
    .selectFrom("User")
    .select(["id", "tenant_id", "email", "first_name", "last_name", "role", "active", "createdAt"]);
  if (manager) qb = qb.where(visible);

  if (role !== "all") qb = qb.where("User.role", "=", role);

  if (storeId) {
    qb = qb.where(
      sql<SqlBool>`EXISTS (
        SELECT 1 FROM "latest_assignment" la
        WHERE la."user_id" = "User"."id" AND la."assigned" AND la."store_id" = ${storeId}
      )`,
    );
    // A manager can only ever filter by their own Stores — an invisible
    // Store id must not act as a window into Users it cannot see.
    if (manager) qb = qb.where(sql<SqlBool>`${storeId} = ANY(${callerStoreIds})`);
  }

  if (search) {
    // Escape LIKE wildcards so a literal % or _ in the term stays literal.
    const like = `%${search.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
    // The store-name match is restricted to the caller's visible Stores too,
    // so a manager searching a Store name they cannot see learns nothing.
    const storeNameScope = manager ? sql`AND la."store_id" = ANY(${callerStoreIds})` : sql``;
    qb = qb.where(
      sql<SqlBool>`(
        "User"."email" ILIKE ${like} OR
        trim(lower(coalesce("User"."first_name", '') || ' ' || coalesce("User"."last_name", ''))) ILIKE ${like} OR
        EXISTS (
          SELECT 1 FROM "latest_assignment" la
          JOIN "Store" s ON s."id" = la."store_id"
          WHERE la."user_id" = "User"."id" AND la."assigned" AND s."name" ILIKE ${like}
          ${storeNameScope}
        )
      )`,
    );
  }

  if (sort.key === "name")
    qb = qb.orderBy(
      sql`trim(lower(coalesce("User"."first_name", '') || ' ' || coalesce("User"."last_name", '')))`,
      sort.direction,
    );
  else if (sort.key === "email") qb = qb.orderBy(sql`lower("User"."email")`, sort.direction);
  else if (sort.key === "role") qb = qb.orderBy("User.role", sort.direction);
  // Active-first matches the client's former status sort (active = 0).
  else qb = qb.orderBy("User.active", sort.direction === "asc" ? "desc" : "asc");
  qb = qb.orderBy("User.id", "asc");

  const envelope = await executeWithOffsetPagination(qb, { page, perPage });

  // The page headline ("N employees · M active") counts the whole visible
  // roster, independent of the current filter — one aggregate alongside the
  // page, under the same visibility as the rows.
  let summaryQb = latestAssignment(db, now)
    .selectFrom("User")
    .select([
      sql<number>`count(*)::int`.as("total"),
      sql<number>`count(*) FILTER (WHERE "active")::int`.as("active"),
    ]);
  if (manager) summaryQb = summaryQb.where(visible);
  const summary = await summaryQb.executeTakeFirstOrThrow();

  // One batched read for the page's assignment sets, then the caller's
  // visibility projection (managers only) — the per-row loop the old handler
  // ran for every User in the Tenant now runs once per page.
  const pageIds = envelope.items.map((row) => row.id);
  const assignmentRows =
    pageIds.length > 0
      ? await latestAssignment(db, now)
          .selectFrom("latest_assignment")
          .select(["user_id", "store_id"])
          .where("assigned", "=", true)
          .where("user_id", "in", pageIds)
          .execute()
      : [];
  const storeIdsByUser = new Map<string, string[]>();
  for (const row of assignmentRows) {
    if (manager && !callerStoreIds.includes(row.store_id)) continue;
    const set = storeIdsByUser.get(row.user_id) ?? [];
    set.push(row.store_id);
    storeIdsByUser.set(row.user_id, set);
  }

  return {
    ...envelope,
    totalCount: summary.total,
    activeCount: summary.active,
    storeIdsByUser,
  };
};
