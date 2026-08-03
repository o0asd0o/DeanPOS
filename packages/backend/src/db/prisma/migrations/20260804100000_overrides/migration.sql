-- Issue 12, record 060 Q3: two append-only tables. RLS block copied
-- verbatim from 20260803010000_tenant_settings — REVOKE ALL then
-- GRANT SELECT, INSERT, FOR SELECT/FOR INSERT policies only.

-- CreateTable
CREATE TABLE "Override" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "approver_user_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "approved_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Override_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Override_tenant_id_id_key" ON "Override"("tenant_id", "id");
CREATE INDEX "Override_tenant_id_idx" ON "Override"("tenant_id");

-- ADR-0005's fixed four; a fifth is an ADR amendment, not a migration.
ALTER TABLE "Override" ADD CONSTRAINT "Override_action_type_check"
  CHECK ("action_type" IN ('void_paid_order','refund','line_price_override','drawer_variance'));
ALTER TABLE "Override" ADD CONSTRAINT "Override_reason_check"
  CHECK (btrim("reason") <> '' AND length("reason") <= 200);
ALTER TABLE "Override" ADD CONSTRAINT "Override_note_check"
  CHECK ("note" IS NULL OR (btrim("note") <> '' AND length("note") <= 500));
-- approved_at is the terminal's claim; created_at is the server clock — the
-- gap between them is the only forensic tell an offline row leaves.
ALTER TABLE "Override" ADD CONSTRAINT "Override_approved_at_check"
  CHECK ("approved_at" <= "created_at" + INTERVAL '5 minutes');

ALTER TABLE "Override" ADD CONSTRAINT "Override_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Override" ADD CONSTRAINT "Override_tenant_id_store_id_fkey"
  FOREIGN KEY ("tenant_id", "store_id") REFERENCES "Store"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Override" ADD CONSTRAINT "Override_tenant_id_device_id_fkey"
  FOREIGN KEY ("tenant_id", "device_id") REFERENCES "Device"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Override" ADD CONSTRAINT "Override_tenant_id_approver_user_id_fkey"
  FOREIGN KEY ("tenant_id", "approver_user_id") REFERENCES "User"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

REVOKE ALL ON "Override" FROM "deanpos_app";
GRANT SELECT, INSERT ON "Override" TO "deanpos_app";

ALTER TABLE "Override" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Override" FORCE ROW LEVEL SECURITY;
CREATE POLICY "override_tenant_isolation_select" ON "Override"
  FOR SELECT USING ("tenant_id" = current_setting('app.tenant_id', true));
CREATE POLICY "override_tenant_isolation_insert" ON "Override"
  FOR INSERT WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

-- CreateTable
CREATE TABLE "OverrideConsumption" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "override_id" TEXT NOT NULL,
    "order_id" TEXT,
    "drawer_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OverrideConsumption_pkey" PRIMARY KEY ("id")
);

-- The control (record 060 Q2): a unique index, not ON CONFLICT, is what
-- Postgres documents atomicity for. Later areas add their own composite FK
-- to order_id/drawer_session_id in the migration creating their own table.
CREATE UNIQUE INDEX "OverrideConsumption_tenant_id_override_id_key" ON "OverrideConsumption"("tenant_id", "override_id");
CREATE INDEX "OverrideConsumption_tenant_id_idx" ON "OverrideConsumption"("tenant_id");

-- Exactly one subject — 056's DeviceAudit shape reused, not a polymorphic
-- subject_type/subject_id pair.
ALTER TABLE "OverrideConsumption" ADD CONSTRAINT "OverrideConsumption_subject_check"
  CHECK ((("order_id" IS NULL)::int + ("drawer_session_id" IS NULL)::int) = 1);

ALTER TABLE "OverrideConsumption" ADD CONSTRAINT "OverrideConsumption_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OverrideConsumption" ADD CONSTRAINT "OverrideConsumption_tenant_id_override_id_fkey"
  FOREIGN KEY ("tenant_id", "override_id") REFERENCES "Override"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

REVOKE ALL ON "OverrideConsumption" FROM "deanpos_app";
GRANT SELECT, INSERT ON "OverrideConsumption" TO "deanpos_app";

ALTER TABLE "OverrideConsumption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OverrideConsumption" FORCE ROW LEVEL SECURITY;
CREATE POLICY "override_consumption_tenant_isolation_select" ON "OverrideConsumption"
  FOR SELECT USING ("tenant_id" = current_setting('app.tenant_id', true));
CREATE POLICY "override_consumption_tenant_isolation_insert" ON "OverrideConsumption"
  FOR INSERT WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));
