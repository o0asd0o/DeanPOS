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

-- CreateIndex
CREATE INDEX "UserRole_user_id_effective_from_idx" ON "UserRole"("user_id", "effective_from");

-- CreateIndex
CREATE INDEX "UserStore_tenant_id_idx" ON "UserStore"("tenant_id");

-- CreateIndex
CREATE INDEX "UserStore_user_id_store_id_effective_from_idx" ON "UserStore"("user_id", "store_id", "effective_from");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStore" ADD CONSTRAINT "UserStore_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStore" ADD CONSTRAINT "UserStore_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStore" ADD CONSTRAINT "UserStore_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only (issue 04, PRD security criterion 21; record 029's pattern):
-- deanpos_app may read and append but never update or delete a row, so the
-- rule is structural, not merely undocumented.
REVOKE ALL ON "UserRole" FROM "deanpos_app";
GRANT SELECT, INSERT ON "UserRole" TO "deanpos_app";

REVOKE ALL ON "UserStore" FROM "deanpos_app";
GRANT SELECT, INSERT ON "UserStore" TO "deanpos_app";

ALTER TABLE "UserRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserRole" FORCE ROW LEVEL SECURITY;
CREATE POLICY "user_role_tenant_isolation" ON "UserRole"
  USING ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "UserStore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserStore" FORCE ROW LEVEL SECURITY;
CREATE POLICY "user_store_tenant_isolation" ON "UserStore"
  USING ("tenant_id" = current_setting('app.tenant_id', true));
