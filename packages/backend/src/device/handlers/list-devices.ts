import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listDevices } from "../db-operations/queries/list-devices.query.ts";
import { toDeviceOutput } from "../helpers.ts";

export const inputSchema = z.object({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(10),
  health: z.enum(["all", "online", "stale", "offline"]).default("all"),
  storeId: z.string().optional(),
  search: z.string().max(100).optional(),
  sort: z
    .object({
      key: z.enum(["name", "store", "assignedTo", "lastSeen", "status"]),
      direction: z.enum(["asc", "desc"]),
    })
    .default({ key: "name", direction: "asc" }),
});
type ListDevicesInput = z.infer<typeof inputSchema>;

type ListResult = Awaited<ReturnType<typeof listDevices>>;
type DeviceOutput = ReturnType<typeof toDeviceOutput>;
type ListOutput = Omit<ListResult, "items"> & { items: DeviceOutput[] };

// The refused caller's page: nothing to show, but still an envelope — the
// shape is what the contract promises, and a refused principal must not leak
// even a count.
const emptyPage = (input: ListDevicesInput): ListOutput => ({
  items: [],
  count: 0,
  page: input.page ?? 1,
  perPage: input.perPage ?? 10,
  hasNextPage: false,
  hasPrevPage: false,
  totalCount: 0,
  activeCount: 0,
});

// `admin` only, and the route itself refuses (record 056 §"Smaller calls" 5)
// — the empty page for any non-admin or unauthenticated caller.
export const handler: Handler<ListDevicesInput, ListOutput> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return emptyPage(input);
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return emptyPage(input);

  return withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const result = await listDevices(scopedDb, input);
    return { ...result, items: result.items.map(toDeviceOutput) };
  });
};
