import { deviceCtx } from "../../common/ctx.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getPinRoster } from "../db-operations/queries/get-pin-roster.query.ts";

type PinSyncUser = {
  userId: string;
  displayName: string;
  pinHash: string | null;
  canApproveOverride: boolean;
};
type PinSyncResult = { storeId: string; syncedAt: string; users: PinSyncUser[] } | null;

// Device-token only, no input at all (issue 10, record 057 Q3) — a wrong
// Store has no field to ask with, so refusal is deviceCtx returning null.
// Computed fresh from the database on every call: no cursor, no cache.
export const handler: Handler<void, PinSyncResult> = async ({ ctx }) => {
  const deviceCtxValue = deviceCtx(ctx);
  if (!deviceCtxValue) return null;
  const { tenantId, storeId } = deviceCtxValue.device;

  const roster = await withTenantScope(ctx.db, tenantId, (scopedDb) =>
    getPinRoster(scopedDb, storeId),
  );

  return { storeId, syncedAt: new Date().toISOString(), users: roster };
};
