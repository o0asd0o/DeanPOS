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
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Store_tenantId_idx" ON "Store"("tenantId");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The application role. Neither superuser nor the owner of any tenant-owned
-- table (issue 01, .scratch/tenancy-identity/issues/01-tenant-isolation-spine.md).
-- Password is fixed and documented in .env.example — RLS FORCED is the real
-- boundary, not this credential. A lane and a deployment both provision it by
-- running this same migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'deanpos_app') THEN
    CREATE ROLE "deanpos_app" LOGIN PASSWORD 'deanpos_app';
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
GRANT SELECT, INSERT, UPDATE, DELETE ON "Store" TO "deanpos_app";

-- RLS ENABLED and FORCED in the same migration that creates the table
-- (issue 01 acceptance criteria; ADR-0002). FORCED so the table owner does
-- not bypass it. current_setting(..., true) returns NULL when unset, and
-- NULL = anything is never true, so a connection with no tenant set sees
-- nothing rather than everything.
ALTER TABLE "Store" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Store" FORCE ROW LEVEL SECURITY;

CREATE POLICY "store_tenant_isolation" ON "Store"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- Tenant is the isolation root and sits outside tenant RLS by construction —
-- it carries no tenant_id for a tenant policy to compare against. ENABLED,
-- FORCED, and deliberately given no policy: Postgres denies every row to a
-- non-owner role (deanpos_app included) when RLS is on and no policy grants
-- access. Unreachable from a tenant-scoped principal today; issue 02 adds
-- the platform-admin path that reaches it.
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
