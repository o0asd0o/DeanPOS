import { deviceCtx } from "../../common/ctx.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getAssignedUserStatus } from "../db-operations/queries/get-assigned-user-status.query.ts";
import { getPinRoster } from "../db-operations/queries/get-pin-roster.query.ts";

type PinSyncUser = {
  userId: string;
  displayName: string;
  pinHash: string | null;
  canApproveOverride: boolean;
};
type PinSyncResult = {
  storeId: string;
  syncedAt: string;
  users: PinSyncUser[];
  assignedUserId: string | null;
  assignedUserStatus: "deactivated" | "unassigned" | null;
} | null;

// Device-token only, no input at all (issue 10, record 057 Q3) — a wrong
// Store has no field to ask with, so refusal is deviceCtx returning null.
// Computed fresh from the database on every call: no cursor, no cache.
export const handler: Handler<void, PinSyncResult> = async ({ ctx }) => {
  const deviceCtxValue = deviceCtx(ctx);
  if (!deviceCtxValue) return null;
  const { tenantId, storeId, assignedUserId } = deviceCtxValue.device;

  return withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const roster = await getPinRoster(scopedDb, storeId, assignedUserId);

    // Absent from the roster: the assigned User was excluded during
    // filtering, either deactivated or unassigned since the last sync
    // (issue 17 — "the screen says which of those it is").
    const assignedUserStatus =
      assignedUserId !== null && !roster.some((user) => user.userId === assignedUserId)
        ? await getAssignedUserStatus(scopedDb, assignedUserId)
        : null;

    return {
      storeId,
      syncedAt: new Date().toISOString(),
      users: roster,
      assignedUserId,
      assignedUserStatus,
    };
  });
};
