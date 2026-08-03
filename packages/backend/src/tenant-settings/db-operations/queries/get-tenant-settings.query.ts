import type { DatabaseInstance } from "../../../db/client.ts";

// Tenant carries no tenant_id of its own (it is the isolation root); the
// tenant_settings_select RLS policy is what confines this to the caller's
// own row, keyed on id instead.
export const getTenantSettings = (db: DatabaseInstance, tenantId: string) =>
  db.selectFrom("Tenant").selectAll().where("id", "=", tenantId).executeTakeFirst();
