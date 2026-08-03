import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listDevices } from "../db-operations/queries/list-devices.query.ts";
import { toDeviceOutput } from "../helpers.ts";

type DeviceOutput = ReturnType<typeof toDeviceOutput>;

// `admin` only, and the route itself refuses (record 056 §"Smaller calls" 5)
// — empty array for any non-admin or unauthenticated caller.
export const handler: Handler<void, DeviceOutput[]> = async ({ ctx }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return [];
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return [];

  const devices = await withTenantScope(ctx.db, tenantId, (scopedDb) => listDevices(scopedDb));
  return devices.map(toDeviceOutput);
};
