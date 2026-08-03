import { randomUUID } from "node:crypto";

import { z } from "zod";

import { deviceCtx } from "../../common/ctx.ts";
import type { Handler } from "../../common/handler.ts";
import { getDevice } from "../../device/db-operations/queries/get-device.query.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertOverride } from "../db-operations/commands/insert-override.command.ts";
import { isAfterDeviceEnrolment, verifyOverrideAsOf } from "../helpers.ts";

const ACTION_TYPES = [
  "void_paid_order",
  "refund",
  "line_price_override",
  "drawer_variance",
] as const;

export const inputSchema = z.object({
  approverUserId: z.string(),
  actionType: z.enum(ACTION_TYPES),
  reason: z.string().trim().min(1).max(200),
  note: z.string().trim().min(1).max(500).optional(),
  approvedAt: z.date(),
});
type RecordOverrideInput = z.infer<typeof inputSchema>;
type RecordOverrideResult = { ok: true; overrideId: string } | { ok: false };

// Device-token only (record 060 Q1) — the PIN is verified on the terminal,
// never here. The server trusts the Device token (fixing tenant/store/
// device) plus verifyOverrideAsOf, never the PIN itself.
export const handler: Handler<RecordOverrideInput, RecordOverrideResult> = async ({
  ctx,
  input,
}) => {
  const deviceCtxValue = deviceCtx(ctx);
  if (!deviceCtxValue) return { ok: false };
  const { tenantId, deviceId, storeId } = deviceCtxValue.device;

  return withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const device = await getDevice(scopedDb, deviceId);
    if (!device) return { ok: false };
    if (!isAfterDeviceEnrolment(input.approvedAt, device.enrolled_at)) return { ok: false };

    const verified = await verifyOverrideAsOf(scopedDb, {
      tenantId,
      userId: input.approverUserId,
      storeId,
      asOf: input.approvedAt,
    });
    if (!verified.ok) return { ok: false };

    const override = await insertOverride(scopedDb, {
      id: randomUUID(),
      tenantId,
      storeId,
      deviceId,
      approverUserId: input.approverUserId,
      actionType: input.actionType,
      reason: input.reason,
      note: input.note ?? null,
      approvedAt: input.approvedAt,
    });

    return { ok: true, overrideId: override.id };
  });
};
