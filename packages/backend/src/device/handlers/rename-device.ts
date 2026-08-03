import { randomUUID } from "node:crypto";

import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertDeviceAudit } from "../db-operations/commands/insert-device-audit.command.ts";
import { renameDevice } from "../db-operations/commands/rename-device.command.ts";
import { getDeviceForUpdate } from "../db-operations/queries/get-device-for-update.query.ts";
import { toDeviceOutput } from "../helpers.ts";

export const inputSchema = z.object({ id: z.string(), name: z.string().min(1) });
type RenameDeviceInput = z.infer<typeof inputSchema>;
type DeviceOutput = ReturnType<typeof toDeviceOutput>;

// `admin` only. A revoked Device may still be renamed — it still names past
// sales (record 056 Q5).
export const handler: Handler<RenameDeviceInput, DeviceOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId || !ctx.principal.role) return null;
  const { tenantId, userId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return null;

  return withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const existing = await getDeviceForUpdate(scopedDb, input.id);
    if (!existing) return null;

    const updated = await renameDevice(scopedDb, input.id, input.name);
    if (!updated) return null;

    await insertDeviceAudit(scopedDb, {
      id: randomUUID(),
      tenantId,
      actorUserId: userId,
      deviceId: input.id,
      enrolmentCodeId: null,
      field: "name",
      oldValue: existing.name,
      newValue: input.name,
    });

    return toDeviceOutput(updated);
  });
};
