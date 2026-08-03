-- CreateEnum
CREATE TYPE "PaymentMethodKind" AS ENUM ('cash', 'recorded');

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PaymentMethodKind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_tenant_id_id_key" ON "PaymentMethod"("tenant_id", "id");
CREATE INDEX "PaymentMethod_tenant_id_idx" ON "PaymentMethod"("tenant_id");

-- The till can never be configured into a state where nothing can be sold
-- (issue 08): a partial unique index, not an application check, refuses a
-- second `cash`-kind method for a Tenant even under two concurrent inserts.
CREATE UNIQUE INDEX "PaymentMethod_one_cash_per_tenant" ON "PaymentMethod"("tenant_id")
  WHERE "kind" = 'cash';

ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Deactivated, never deleted (issue 08 acceptance criteria) — no DELETE grant.
REVOKE ALL ON "PaymentMethod" FROM "deanpos_app";
GRANT SELECT, INSERT, UPDATE ON "PaymentMethod" TO "deanpos_app";

ALTER TABLE "PaymentMethod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentMethod" FORCE ROW LEVEL SECURITY;
CREATE POLICY "payment_method_tenant_isolation" ON "PaymentMethod"
  USING ("tenant_id" = current_setting('app.tenant_id', true));

-- CreateTable
CREATE TABLE "PaymentMethodAvailability" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "payment_method_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethodAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodAvailability_payment_method_id_store_id_key"
  ON "PaymentMethodAvailability"("payment_method_id", "store_id");
CREATE INDEX "PaymentMethodAvailability_tenant_id_idx" ON "PaymentMethodAvailability"("tenant_id");

-- Composite FKs, not plain ones — the same cross-tenant trap issue 04 found.
ALTER TABLE "PaymentMethodAvailability" ADD CONSTRAINT "PaymentMethodAvailability_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentMethodAvailability" ADD CONSTRAINT "PaymentMethodAvailability_tenant_id_payment_method_id_fkey"
  FOREIGN KEY ("tenant_id", "payment_method_id") REFERENCES "PaymentMethod"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentMethodAvailability" ADD CONSTRAINT "PaymentMethodAvailability_tenant_id_store_id_fkey"
  FOREIGN KEY ("tenant_id", "store_id") REFERENCES "Store"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Current state only, no effective dating (record 054): rows are inserted and
-- deleted directly, so this table keeps the full CRUD the default privileges
-- rule already grants (packages/backend .../20260802065946_tenant_isolation_spine).
ALTER TABLE "PaymentMethodAvailability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentMethodAvailability" FORCE ROW LEVEL SECURITY;
CREATE POLICY "payment_method_availability_tenant_isolation" ON "PaymentMethodAvailability"
  USING ("tenant_id" = current_setting('app.tenant_id', true));

-- CreateTable
CREATE TABLE "PaymentMethodAudit" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "payment_method_id" TEXT NOT NULL,
    "store_id" TEXT,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethodAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentMethodAudit_tenant_id_idx" ON "PaymentMethodAudit"("tenant_id");

-- An append-only row can never be corrected later, so its shape is enforced
-- here rather than trusted to application code (record 054 Q1).
ALTER TABLE "PaymentMethodAudit" ADD CONSTRAINT "PaymentMethodAudit_field_check"
  CHECK ("field" IN ('created', 'name', 'active', 'available'));
ALTER TABLE "PaymentMethodAudit" ADD CONSTRAINT "PaymentMethodAudit_available_has_store_check"
  CHECK (("field" = 'available') = ("store_id" IS NOT NULL));
ALTER TABLE "PaymentMethodAudit" ADD CONSTRAINT "PaymentMethodAudit_created_has_no_old_value_check"
  CHECK (("old_value" IS NULL) = ("field" = 'created'));

ALTER TABLE "PaymentMethodAudit" ADD CONSTRAINT "PaymentMethodAudit_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentMethodAudit" ADD CONSTRAINT "PaymentMethodAudit_tenant_id_actor_user_id_fkey"
  FOREIGN KEY ("tenant_id", "actor_user_id") REFERENCES "User"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentMethodAudit" ADD CONSTRAINT "PaymentMethodAudit_tenant_id_payment_method_id_fkey"
  FOREIGN KEY ("tenant_id", "payment_method_id") REFERENCES "PaymentMethod"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentMethodAudit" ADD CONSTRAINT "PaymentMethodAudit_tenant_id_store_id_fkey"
  FOREIGN KEY ("tenant_id", "store_id") REFERENCES "Store"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only, structurally (record 054 Q1, copying the shipped
-- 20260803010000_tenant_settings RLS block verbatim, table name swapped).
REVOKE ALL ON "PaymentMethodAudit" FROM "deanpos_app";
GRANT SELECT, INSERT ON "PaymentMethodAudit" TO "deanpos_app";

ALTER TABLE "PaymentMethodAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentMethodAudit" FORCE ROW LEVEL SECURITY;
CREATE POLICY "payment_method_audit_tenant_isolation_select" ON "PaymentMethodAudit"
  FOR SELECT USING ("tenant_id" = current_setting('app.tenant_id', true));
CREATE POLICY "payment_method_audit_tenant_isolation_insert" ON "PaymentMethodAudit"
  FOR INSERT WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

-- This issue amends provisioning (issue 02) to seed `cash`; existing Tenants
-- gain it here, in the same migration. No audit row: provisioning writes no
-- actor, and `PaymentMethodAudit.actor_user_id` stays NOT NULL (record 054).
INSERT INTO "PaymentMethod" ("id", "tenant_id", "name", "kind", "active")
  SELECT gen_random_uuid()::text, "id", 'Cash', 'cash', true FROM "Tenant";
