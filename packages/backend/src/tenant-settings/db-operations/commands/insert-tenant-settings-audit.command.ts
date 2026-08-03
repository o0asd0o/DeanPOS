import type { DatabaseInstance } from "../../../db/client.ts";

// One row per changed setting (issue 07 criterion 4) — never one row per
// save. `oldValue`/`newValue` are text; the setting name says the type.
export const insertTenantSettingsAudit = (
  db: DatabaseInstance,
  values: {
    id: string;
    tenantId: string;
    actorUserId: string;
    setting: string;
    oldValue: string;
    newValue: string;
  },
) =>
  db
    .insertInto("TenantSettingsAudit")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      actor_user_id: values.actorUserId,
      setting: values.setting,
      old_value: values.oldValue,
      new_value: values.newValue,
    })
    .execute();
