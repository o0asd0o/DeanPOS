import { z } from "zod";

import { getAssignedStoreIdsAsOf } from "../../access/db-operations/queries/get-assigned-store-ids-as-of.query.ts";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listUsers } from "../db-operations/queries/list-users.query.ts";
import { toUserOutput } from "../helpers.ts";

export const inputSchema = z.object({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(1000).default(10),
  role: z.enum(["all", "cashier", "manager", "admin"]).default("all"),
  storeId: z.string().optional(),
  search: z.string().max(100).optional(),
  sort: z
    .object({
      key: z.enum(["name", "email", "role", "status"]),
      direction: z.enum(["asc", "desc"]),
    })
    .default({ key: "name", direction: "asc" }),
});
type ListUsersInput = z.infer<typeof inputSchema>;

type ListResult = Awaited<ReturnType<typeof listUsers>>;
type UserOutput = ReturnType<typeof toUserOutput>;
type ListOutput = Omit<ListResult, "items" | "storeIdsByUser"> & { items: UserOutput[] };

// The refused caller's page: nothing to show, but still an envelope — the
// shape is what the contract promises, and a refused principal must not leak
// even a count (record 044 §2, kept by record 076).
const emptyPage = (input: ListUsersInput): ListOutput => ({
  items: [],
  count: 0,
  page: input.page ?? 1,
  perPage: input.perPage ?? 10,
  hasNextPage: false,
  hasPrevPage: false,
  totalCount: 0,
  activeCount: 0,
});

// The roster page (record 044 §2, amended by 076): `manager` and up — a
// `cashier` gets the empty envelope, never an error. The caller's own Store
// visibility is resolved once here and handed to the query, which keeps every
// filter and count inside it.
export const handler: Handler<ListUsersInput, ListOutput> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId || !ctx.principal.role) return emptyPage(input);
  const { tenantId, userId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return emptyPage(input);

  return withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const now = new Date();
    const callerStoreIds = await getAssignedStoreIdsAsOf(scopedDb, userId, now);
    const result = await listUsers(scopedDb, {
      ...input,
      callerRole: role,
      callerUserId: userId,
      callerStoreIds,
      now,
    });
    return {
      ...result,
      items: result.items.map((row) =>
        toUserOutput(row, result.storeIdsByUser.get(row.id) ?? []),
      ),
    };
  });
};
