import type { DatabaseInstance } from "../../../db/client.ts";

export type InsertOverrideInput = {
  id: string;
  tenantId: string;
  storeId: string;
  deviceId: string;
  approverUserId: string;
  actionType: string;
  reason: string;
  note: string | null;
  approvedAt: Date;
};

// Append-only (record 060 Q3) — no UPDATE grant exists for this table.
export const insertOverride = (db: DatabaseInstance, input: InsertOverrideInput) =>
  db
    .insertInto("Override")
    .values({
      id: input.id,
      tenant_id: input.tenantId,
      store_id: input.storeId,
      device_id: input.deviceId,
      approver_user_id: input.approverUserId,
      action_type: input.actionType,
      reason: input.reason,
      note: input.note,
      approved_at: input.approvedAt,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
