-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Store_tenantId_idx" ON "Store"("tenant_id");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_tenantId_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The application role: not superuser, not the owner of any tenant-owned table.
-- The password is a development default, overridden per deployment out of band —
-- never in a migration. See .scratch/decisions/027-the-app-role-credential.md.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'deanpos_app') THEN
    CREATE ROLE "deanpos_app" LOGIN PASSWORD 'deanpos_app';
  END IF;
  IF EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'deanpos_app' AND (rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'deanpos_app exists with SUPERUSER or BYPASSRLS — refusing to grant table access';
  END IF;
END
$$;

-- Every table created from here on by the migrating role is readable and
-- writable by the app role with no per-migration grant.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "deanpos_app";
GRANT USAGE ON SCHEMA public TO "deanpos_app";

-- Ping predates the default-privileges rule above; grant it explicitly.
GRANT SELECT ON "Ping" TO "deanpos_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON "Tenant" TO "deanpos_app";
-- Store is deactivated, never deleted (issue 01 acceptance criteria) — no DELETE grant.
GRANT SELECT, INSERT, UPDATE ON "Store" TO "deanpos_app";

-- RLS ENABLED and FORCED so the owner does not bypass it (ADR-0002; issue 01
-- acceptance criteria). NULL app.tenant_id matches nothing, so an unscoped
-- connection sees zero rows rather than everything.
ALTER TABLE "Store" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Store" FORCE ROW LEVEL SECURITY;

CREATE POLICY "store_tenant_isolation" ON "Store"
  USING ("tenant_id" = current_setting('app.tenant_id', true));

-- Tenant is the isolation root: ENABLED, FORCED, and given no policy, so
-- Postgres denies every row to deanpos_app by default. Unreachable from a
-- tenant-scoped principal until issue 02 adds a platform-admin path.
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
