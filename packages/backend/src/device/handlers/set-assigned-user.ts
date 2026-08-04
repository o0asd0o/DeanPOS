import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getAssignedStoreIdsAsOf } from "../../access/db-operations/queries/get-assigned-store-ids-as-of.query.ts";
import { findUserById } from "../../auth/db-operations/queries/find-user-by-id.query.ts";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertDeviceAudit } from "../db-operations/commands/insert-device-audit.command.ts";
import { setAssignedUser } from "../db-operations/commands/set-assigned-user.command.ts";
import { getDeviceForUpdate } from "../db-operations/queries/get-device-for-update.query.ts";
import { toDeviceOutput } from "../helpers.ts";

export const inputSchema = z.object({ id: z.string(), userId: z.string().nullable() });
type SetAssignedUserInput = z.infer<typeof inputSchema>;
type DeviceOutput = ReturnType<typeof toDeviceOutput>;

const CLEARED_SENTINEL = "";

// `admin` only (record 056 Q5). A non-null target must be an active User
// currently assigned to this Device's Store, refused server-side.
export const handler: Handler<SetAssignedUserInput, DeviceOutput | null> = async ({
  ctx,
  input,
}) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId || !ctx.principal.role) return null;
  const { tenantId, userId: actorId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return null;

  return withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const existing = await getDeviceForUpdate(scopedDb, input.id);
    if (!existing) return null;

    if (input.userId !== null) {
      const target = await findUserById(scopedDb, input.userId);
      if (!target || !target.active) return null;
      const storeIds = await getAssignedStoreIdsAsOf(scopedDb, input.userId, new Date());
      if (!storeIds.includes(existing.store_id)) return null;
    }

    const updated = await setAssignedUser(scopedDb, input.id, input.userId);
    if (!updated) return null;

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
      newValue: input.userId ?? CLEARED_SENTINEL,
    });

    return toDeviceOutput(updated);
  });
};
