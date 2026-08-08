import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getAssignedStoreIdsAsOf } from "../../access/db-operations/queries/get-assigned-store-ids-as-of.query.ts";
import { findUserById } from "../../auth/db-operations/queries/find-user-by-id.query.ts";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertDeviceAudit } from "../db-operations/commands/insert-device-audit.command.ts";
import { renameDevice } from "../db-operations/commands/rename-device.command.ts";
import { setAssignedUser } from "../db-operations/commands/set-assigned-user.command.ts";
import { getDeviceForUpdate } from "../db-operations/queries/get-device-for-update.query.ts";
import { toDeviceOutput } from "../helpers.ts";

export const inputSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  assignedUserId: z.string().nullable(),
});
type UpdateDeviceInput = z.infer<typeof inputSchema>;
type DeviceOutput = ReturnType<typeof toDeviceOutput>;

const CLEARED_SENTINEL = "";

// `admin` only (record 056 Q5). One call for the editor sheet: name and
// assignment land together, each audited only when it actually changes. A
// non-null target must be an active User currently assigned to this Device's
// Store, refused server-side — the same rule `setAssignedUser` enforces.
export const handler: Handler<UpdateDeviceInput, DeviceOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId || !ctx.principal.role) return null;
  const { tenantId, userId: actorId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return null;

  return withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const existing = await getDeviceForUpdate(scopedDb, input.id);
    if (!existing) return null;

    // Validate a non-null target before any write, so a refused update
    // changes nothing — the sheet saves name and assignment as one unit.
    if (input.assignedUserId !== null && input.assignedUserId !== existing.assigned_user_id) {
      const target = await findUserById(scopedDb, input.assignedUserId);
      if (!target || !target.active) return null;
      const storeIds = await getAssignedStoreIdsAsOf(scopedDb, input.assignedUserId, new Date());
      if (!storeIds.includes(existing.store_id)) return null;
    }

    let updated = existing;
    if (input.name !== existing.name) {
      const renamed = await renameDevice(scopedDb, input.id, input.name);
      if (!renamed) return null;
      updated = renamed;
      await insertDeviceAudit(scopedDb, {
        id: randomUUID(),
        tenantId,
        actorUserId: actorId,
        deviceId: input.id,
        enrolmentCodeId: null,
        field: "name",
        oldValue: existing.name,
        newValue: input.name,
      });
    }

    if (input.assignedUserId !== existing.assigned_user_id) {
      const assigned = await setAssignedUser(scopedDb, input.id, input.assignedUserId);
      if (!assigned) return null;
      updated = assigned;
      await insertDeviceAudit(scopedDb, {
        id: randomUUID(),
        tenantId,
        actorUserId: actorId,
        deviceId: input.id,
        enrolmentCodeId: null,
        field: "assigned_user",
        oldValue: existing.assigned_user_id,
        // `new_value` is NOT NULL (record 056 Q1), so clearing can't write a
        // real NULL. "" stands for it instead — no userId is ever empty, so
        // a reader can't mistake it for one.
        newValue: input.assignedUserId ?? CLEARED_SENTINEL,
      });
    }

    return toDeviceOutput(updated);
  });
};
