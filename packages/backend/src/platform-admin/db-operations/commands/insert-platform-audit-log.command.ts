import type { DatabaseInstance } from "../../../db/client.ts";

export const insertPlatformAuditLog = (
  db: DatabaseInstance,
  values: { id: string; platformAdminId: string; action: string; tenantId: string },
) =>
  db
    .insertInto("PlatformAuditLog")
    .values({
      id: values.id,
      platform_admin_id: values.platformAdminId,
      action: values.action,
      tenant_id: values.tenantId,
    })
    .execute();
