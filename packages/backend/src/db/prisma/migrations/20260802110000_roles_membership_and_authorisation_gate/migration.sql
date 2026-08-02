-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStore" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "assigned" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserStore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserRole_tenant_id_idx" ON "UserRole"("tenant_id");

-- Two rows for the same User at the same instant leave "as of T" with no
-- deterministic answer — issue 12 replays an offline Override against
-- exactly that lookup (issue 04, round 1 finding 4). A unique constraint
-- refuses the tie outright rather than picking a winner silently.
-- CreateIndex
CREATE UNIQUE INDEX "UserRole_user_id_effective_from_idx" ON "UserRole"("user_id", "effective_from");

-- CreateIndex
CREATE INDEX "UserStore_tenant_id_idx" ON "UserStore"("tenant_id");

-- Same reasoning as UserRole above, scoped per Store: one User may open or
-- close several Store assignments in the same transaction, so the tie is
-- broken per (user_id, store_id), not per user_id alone.
-- CreateIndex
CREATE UNIQUE INDEX "UserStore_user_id_store_id_effective_from_idx" ON "UserStore"("user_id", "store_id", "effective_from");

-- A history row's tenant_id and user_id/store_id are checked together, not
-- as two independent foreign keys — Postgres foreign-key checks bypass RLS,
-- so an independent user_id FK would let a Tenant A transaction attach
-- history to a Tenant B User merely because that User exists somewhere
-- (issue 04, round 1 finding 2). The referenced (tenant_id, id) pair must
-- be unique before it can be the target of a composite foreign key.
ALTER TABLE "User" ADD CONSTRAINT "User_tenant_id_id_key" UNIQUE ("tenant_id", "id");
ALTER TABLE "Store" ADD CONSTRAINT "Store_tenant_id_id_key" UNIQUE ("tenant_id", "id");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_tenant_id_user_id_fkey" FOREIGN KEY ("tenant_id", "user_id") REFERENCES "User"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStore" ADD CONSTRAINT "UserStore_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStore" ADD CONSTRAINT "UserStore_tenant_id_user_id_fkey" FOREIGN KEY ("tenant_id", "user_id") REFERENCES "User"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStore" ADD CONSTRAINT "UserStore_tenant_id_store_id_fkey" FOREIGN KEY ("tenant_id", "store_id") REFERENCES "Store"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only (issue 04, PRD security criterion 21; record 029's pattern):
-- deanpos_app may read and append but never update or delete a row, so the
-- rule is structural, not merely undocumented.
REVOKE ALL ON "UserRole" FROM "deanpos_app";
GRANT SELECT, INSERT ON "UserRole" TO "deanpos_app";

REVOKE ALL ON "UserStore" FROM "deanpos_app";
GRANT SELECT, INSERT ON "UserStore" TO "deanpos_app";

-- SELECT and INSERT policies only, never FOR ALL — a FOR ALL policy would
-- authorise UPDATE and DELETE at the policy layer, so removing deanpos_app's
-- grant (above) would be the only thing stopping a non-superuser owner
-- under FORCE ROW LEVEL SECURITY, or any future principal later granted
-- UPDATE/DELETE, from mutating matching-tenant history (issue 04, round 1
-- finding 3). The REVOKE above is belt; these policies are the braces.
-- Superuser and BYPASSRLS remain unavoidable administrative exceptions —
-- the migrating role bypasses RLS entirely regardless of policy shape.
ALTER TABLE "UserRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserRole" FORCE ROW LEVEL SECURITY;
CREATE POLICY "user_role_tenant_isolation_select" ON "UserRole"
  FOR SELECT USING ("tenant_id" = current_setting('app.tenant_id', true));
CREATE POLICY "user_role_tenant_isolation_insert" ON "UserRole"
  FOR INSERT WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "UserStore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserStore" FORCE ROW LEVEL SECURITY;
CREATE POLICY "user_store_tenant_isolation_select" ON "UserStore"
  FOR SELECT USING ("tenant_id" = current_setting('app.tenant_id', true));
CREATE POLICY "user_store_tenant_isolation_insert" ON "UserStore"
  FOR INSERT WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));
