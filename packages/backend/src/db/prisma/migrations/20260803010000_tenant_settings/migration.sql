-- Additive only: five new columns on Tenant, all with database-enforced
-- defaults so a freshly provisioned Tenant is correct with no application
-- code (issue 07, record 046 §2).
ALTER TABLE "Tenant" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila';
ALTER TABLE "Tenant" ADD COLUMN "vat_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN "vat_rate_percent" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "Tenant" ADD COLUMN "variance_tolerance_centavos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN "cash_movement_override_threshold_centavos" INTEGER NOT NULL DEFAULT 0;

-- Both centavo columns are non-negative — enforced here, not just accepted
-- as any int; the schema alone is not the authority (records 046 §2, 040).
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_variance_tolerance_centavos_check"
  CHECK ("variance_tolerance_centavos" >= 0);
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_cash_movement_override_threshold_centavos_check"
  CHECK ("cash_movement_override_threshold_centavos" >= 0);

-- First reachable Tenant SELECT/UPDATE policy: a tenant-scoped connection
-- may read and update only its own row, never INSERT/DELETE one.
-- See .scratch/decisions/047-a-tenant-may-read-and-update-its-own-row.md.
CREATE POLICY "tenant_settings_select" ON "Tenant"
  FOR SELECT USING ("id" = current_setting('app.tenant_id', true));
CREATE POLICY "tenant_settings_update" ON "Tenant"
  FOR UPDATE USING ("id" = current_setting('app.tenant_id', true))
  WITH CHECK ("id" = current_setting('app.tenant_id', true));
GRANT UPDATE ON "Tenant" TO "deanpos_app";

-- CreateTable
CREATE TABLE "TenantSettingsAudit" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "setting" TEXT NOT NULL,
    "old_value" TEXT NOT NULL,
    "new_value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantSettingsAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantSettingsAudit_tenant_id_idx" ON "TenantSettingsAudit"("tenant_id");

-- Composite FK on (tenant_id, actor_user_id), not a plain user_id FK — the
-- same cross-tenant trap issue 04 found. See record 046 §3.
ALTER TABLE "TenantSettingsAudit" ADD CONSTRAINT "TenantSettingsAudit_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantSettingsAudit" ADD CONSTRAINT "TenantSettingsAudit_tenant_id_actor_user_id_fkey"
  FOREIGN KEY ("tenant_id", "actor_user_id") REFERENCES "User"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only, structurally (issue 04's pattern, record 046 §3): deanpos_app
-- may read and append but never update or delete a row.
REVOKE ALL ON "TenantSettingsAudit" FROM "deanpos_app";
GRANT SELECT, INSERT ON "TenantSettingsAudit" TO "deanpos_app";

-- SELECT and INSERT policies only, never FOR ALL, which would also
-- authorise UPDATE/DELETE at the policy layer. The REVOKE above is belt;
-- these policies are the braces.
ALTER TABLE "TenantSettingsAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantSettingsAudit" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_settings_audit_tenant_isolation_select" ON "TenantSettingsAudit"
  FOR SELECT USING ("tenant_id" = current_setting('app.tenant_id', true));
CREATE POLICY "tenant_settings_audit_tenant_isolation_insert" ON "TenantSettingsAudit"
  FOR INSERT WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));
