import { randomUUID } from "node:crypto";

import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertDeviceAudit } from "../db-operations/commands/insert-device-audit.command.ts";
import { revokeDevice } from "../db-operations/commands/revoke-device.command.ts";
import { toDeviceOutput } from "../helpers.ts";

export const inputSchema = z.object({ id: z.string() });
type RevokeDeviceInput = z.infer<typeof inputSchema>;
type DeviceOutput = ReturnType<typeof toDeviceOutput>;

// `admin` only. Immediate and permanent — revoking twice is a no-op refusal
// (`revoked_at IS NOT NULL` already), never a second audit row.
export const handler: Handler<RevokeDeviceInput, DeviceOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId || !ctx.principal.role) return null;
  const { tenantId, userId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return null;

  return withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const revokedAt = new Date();
    const updated = await revokeDevice(scopedDb, input.id, revokedAt);
    if (!updated) return null;

    await insertDeviceAudit(scopedDb, {
      id: randomUUID(),
      tenantId,
      actorUserId: userId,
      deviceId: input.id,
      enrolmentCodeId: null,
      field: "revoked",
      oldValue: null,
      newValue: revokedAt.toISOString(),
    });

    return toDeviceOutput(updated);
  });
};
