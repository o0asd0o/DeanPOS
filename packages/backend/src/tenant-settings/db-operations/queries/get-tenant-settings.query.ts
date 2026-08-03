import type { DatabaseInstance } from "../../../db/client.ts";

// Tenant carries no tenant_id of its own (it is the isolation root); the
// tenant_settings_select RLS policy is what confines this to the caller's
// own row, keyed on id instead.
export const getTenantSettings = (db: DatabaseInstance, tenantId: string) =>
  db.selectFrom("Tenant").selectAll().where("id", "=", tenantId).executeTakeFirst();

// Locked read for a diff-then-write save (record 034's pattern, one level
// out): two concurrent saves serialise instead of both reading the same
// pre-image, so the audit chain never skips a transition.
export const getTenantSettingsForUpdate = (db: DatabaseInstance, tenantId: string) =>
  db.selectFrom("Tenant").selectAll().where("id", "=", tenantId).forUpdate().executeTakeFirst();
