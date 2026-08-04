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

-- `assigned_user` may record a previous assignee, so it is exempted from
-- the null-old-value rule rather than folded into `name`'s branch
-- (`.scratch/decisions/056-the-device-principal-its-token-and-its-two-screens.md`).
ALTER TABLE "DeviceAudit" DROP CONSTRAINT "DeviceAudit_name_has_old_value_check";
ALTER TABLE "DeviceAudit" ADD CONSTRAINT "DeviceAudit_name_has_old_value_check"
  CHECK (
    CASE "field"
      WHEN 'name' THEN "old_value" IS NOT NULL
      WHEN 'assigned_user' THEN TRUE
      ELSE "old_value" IS NULL
    END
  );
