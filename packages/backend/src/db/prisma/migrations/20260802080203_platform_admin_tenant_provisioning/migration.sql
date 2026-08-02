-- CreateEnum
CREATE TYPE "Role" AS ENUM ('cashier', 'manager', 'admin');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAuditLog" (
    "id" TEXT NOT NULL,
    "platform_admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_tenant_id_idx" ON "User"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAdmin_email_key" ON "PlatformAdmin"("email");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_tenant_id_idx" ON "PlatformAuditLog"("tenant_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Explicit, not relied on default privileges (record 027's ALTER DEFAULT
-- PRIVILEGES from the previous migration would otherwise also grant DELETE):
-- User deactivates rather than deletes, and the audit log is append-only.
REVOKE ALL ON "User" FROM "deanpos_app";
GRANT SELECT, INSERT, UPDATE ON "User" TO "deanpos_app";

REVOKE ALL ON "PlatformAuditLog" FROM "deanpos_app";
GRANT SELECT, INSERT ON "PlatformAuditLog" TO "deanpos_app";

-- PlatformAdmin: no grant. Nothing in issue 02 reads or writes it through
-- deanpos_app; platform-admin authentication is a later issue's concern.
REVOKE ALL ON "PlatformAdmin" FROM "deanpos_app";

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
CREATE POLICY "user_tenant_isolation" ON "User"
  USING ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "PlatformAdmin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformAdmin" FORCE ROW LEVEL SECURITY;

ALTER TABLE "PlatformAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformAuditLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY "platform_audit_log_append" ON "PlatformAuditLog"
  FOR INSERT WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

-- INSERT-only policy: an INSERT policy has no USING clause, so it cannot
-- also grant SELECT the way a USING-based FOR ALL policy would (record 029).
CREATE POLICY "tenant_provision_insert" ON "Tenant"
  FOR INSERT WITH CHECK ("id" = current_setting('app.tenant_id', true));
REVOKE UPDATE, DELETE ON "Tenant" FROM "deanpos_app";
