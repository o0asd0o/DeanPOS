-- Issue 17: the single-employee terminal. NULL keeps today's open-to-all
-- behaviour with no backfill — every Device enrolled before this migration
-- is unset.
ALTER TABLE "Device" ADD COLUMN "assigned_user_id" TEXT;

ALTER TABLE "Device" ADD CONSTRAINT "Device_tenant_id_assigned_user_id_fkey"
  FOREIGN KEY ("tenant_id", "assigned_user_id") REFERENCES "User"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- The column moves after insert, alongside name/last_seen_at/revoked_at
-- (record 056 Q6) — an admin sets or clears it from the back office.
GRANT UPDATE ("assigned_user_id") ON "Device" TO "deanpos_app";

-- Widens the append-only audit's field allow-list to record the assignment
-- change (issue 17). Additive: no row is dropped or reinterpreted, and every
-- pre-existing field keeps exactly its old behaviour.
ALTER TABLE "DeviceAudit" DROP CONSTRAINT "DeviceAudit_field_check";
ALTER TABLE "DeviceAudit" ADD CONSTRAINT "DeviceAudit_field_check"
  CHECK ("field" IN ('code_generated', 'name', 'revoked', 'assigned_user'));

-- `name_has_old_value_check` forced every non-`name` field to a null
-- `old_value`. `assigned_user` must record the previous assignee (issue 17
-- acceptance criteria), so it is exempted the same way `name` already was —
-- `name` and every other pre-existing field keep exactly their old rule.
ALTER TABLE "DeviceAudit" DROP CONSTRAINT "DeviceAudit_name_has_old_value_check";
ALTER TABLE "DeviceAudit" ADD CONSTRAINT "DeviceAudit_name_has_old_value_check"
  CHECK ("field" IN ('name', 'assigned_user') OR "old_value" IS NULL);
