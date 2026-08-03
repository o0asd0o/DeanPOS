-- Additive only (issue 10, record 057): the PIN's hash on User. Nullable,
-- no default, no backfill. Table-level grant on "User" from
-- 20260802080203_platform_admin_tenant_provisioning already covers UPDATE,
-- so no new grant is needed.
ALTER TABLE "User" ADD COLUMN "pin_hash" TEXT;
