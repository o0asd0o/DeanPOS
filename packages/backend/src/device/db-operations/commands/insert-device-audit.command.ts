import type { DatabaseInstance } from "../../../db/client.ts";

// Exactly one of deviceId/enrolmentCodeId is set (record 056 Q1's CHECKs).
export const insertDeviceAudit = (
  db: DatabaseInstance,
  values: {
    id: string;
    tenantId: string;
    actorUserId: string;
    deviceId: string | null;
    enrolmentCodeId: string | null;
    field: "code_generated" | "name" | "revoked" | "assigned_user";
    oldValue: string | null;
    newValue: string;
  },
) =>
  db
    .insertInto("DeviceAudit")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      actor_user_id: values.actorUserId,
      device_id: values.deviceId,
      enrolment_code_id: values.enrolmentCodeId,
      field: values.field,
      old_value: values.oldValue,
      new_value: values.newValue,
    })
    .execute();
