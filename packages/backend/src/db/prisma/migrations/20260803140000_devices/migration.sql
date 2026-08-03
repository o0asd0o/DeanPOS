-- CreateTable
CREATE TABLE "EnrolmentCode" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "device_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrolmentCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- Record 056 Q4: the admin-typed short code, 2-4 Crockford-safe symbols
-- (excludes I, L, O; keeps 0 and 1).
ALTER TABLE "EnrolmentCode" ADD CONSTRAINT "EnrolmentCode_code_check"
  CHECK ("code" ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ0-9]{2,4}$');
ALTER TABLE "Device" ADD CONSTRAINT "Device_code_check"
  CHECK ("code" ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ0-9]{2,4}$');

-- The separate exchange secret (record 056 smaller call 3): 8 symbols from
-- Crockford's 32-symbol alphabet, unrelated to the receipt-facing code.
ALTER TABLE "EnrolmentCode" ADD CONSTRAINT "EnrolmentCode_secret_check"
  CHECK ("secret" ~ '^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$');

-- CreateIndex
CREATE UNIQUE INDEX "Device_tenant_id_id_key" ON "Device"("tenant_id", "id");
CREATE UNIQUE INDEX "EnrolmentCode_tenant_id_id_key" ON "EnrolmentCode"("tenant_id", "id");
CREATE INDEX "Device_tenant_id_idx" ON "Device"("tenant_id");
CREATE INDEX "EnrolmentCode_tenant_id_idx" ON "EnrolmentCode"("tenant_id");
CREATE UNIQUE INDEX "Device_token_hash_key" ON "Device"("token_hash");
CREATE UNIQUE INDEX "EnrolmentCode_secret_key" ON "EnrolmentCode"("secret");

-- No `WHERE`: a revoked Device's row keeps its code, so it can never be
-- reissued at the same Store (issue 09 acceptance criteria, record 056 Q4).
CREATE UNIQUE INDEX "Device_tenant_store_code_key" ON "Device"("tenant_id", "store_id", "code");

ALTER TABLE "EnrolmentCode" ADD CONSTRAINT "EnrolmentCode_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrolmentCode" ADD CONSTRAINT "EnrolmentCode_tenant_id_store_id_fkey"
  FOREIGN KEY ("tenant_id", "store_id") REFERENCES "Store"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrolmentCode" ADD CONSTRAINT "EnrolmentCode_tenant_id_device_id_fkey"
  FOREIGN KEY ("tenant_id", "device_id") REFERENCES "Device"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Device" ADD CONSTRAINT "Device_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Device" ADD CONSTRAINT "Device_tenant_id_store_id_fkey"
  FOREIGN KEY ("tenant_id", "store_id") REFERENCES "Store"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Never deleted (issue 09 acceptance criteria — revoked, not removed).
-- Column-level grant, record 056 Q6: only name/last_seen_at/revoked_at
-- move after insert — the rest are then immutable by the database.
REVOKE ALL ON "Device" FROM "deanpos_app";
GRANT SELECT, INSERT ON "Device" TO "deanpos_app";
GRANT UPDATE ("name", "last_seen_at", "revoked_at") ON "Device" TO "deanpos_app";

REVOKE ALL ON "EnrolmentCode" FROM "deanpos_app";
GRANT SELECT, INSERT, UPDATE ON "EnrolmentCode" TO "deanpos_app";

ALTER TABLE "Device" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Device" FORCE ROW LEVEL SECURITY;
CREATE POLICY "device_tenant_isolation" ON "Device"
  USING ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "EnrolmentCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EnrolmentCode" FORCE ROW LEVEL SECURITY;
CREATE POLICY "enrolment_code_tenant_isolation" ON "EnrolmentCode"
  USING ("tenant_id" = current_setting('app.tenant_id', true));

-- Pre-auth lookups (record 031's shape, copied literally). The tenant is
-- unknown until the Device/EnrolmentCode is found, so each travels on its
-- own session variable; the transaction that reads it runs one statement.
CREATE POLICY "device_token_lookup" ON "Device"
  FOR SELECT USING ("token_hash" = nullif(current_setting('app.device_token_hash', true), ''));
CREATE POLICY "enrolment_code_lookup" ON "EnrolmentCode"
  FOR SELECT USING ("secret" = nullif(current_setting('app.enrolment_code', true), ''));

-- CreateTable
CREATE TABLE "DeviceAudit" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "device_id" TEXT,
    "enrolment_code_id" TEXT,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceAudit_tenant_id_idx" ON "DeviceAudit"("tenant_id");

-- An append-only row can never be corrected later (record 056 Q1).
ALTER TABLE "DeviceAudit" ADD CONSTRAINT "DeviceAudit_field_check"
  CHECK ("field" IN ('code_generated', 'name', 'revoked'));
ALTER TABLE "DeviceAudit" ADD CONSTRAINT "DeviceAudit_exactly_one_subject_check"
  CHECK ((("device_id" IS NULL)::int + ("enrolment_code_id" IS NULL)::int) = 1);
ALTER TABLE "DeviceAudit" ADD CONSTRAINT "DeviceAudit_code_generated_has_enrolment_code_check"
  CHECK (("field" = 'code_generated') = ("enrolment_code_id" IS NOT NULL));
ALTER TABLE "DeviceAudit" ADD CONSTRAINT "DeviceAudit_name_has_old_value_check"
  CHECK (("old_value" IS NULL) = ("field" <> 'name'));

ALTER TABLE "DeviceAudit" ADD CONSTRAINT "DeviceAudit_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeviceAudit" ADD CONSTRAINT "DeviceAudit_tenant_id_actor_user_id_fkey"
  FOREIGN KEY ("tenant_id", "actor_user_id") REFERENCES "User"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeviceAudit" ADD CONSTRAINT "DeviceAudit_tenant_id_device_id_fkey"
  FOREIGN KEY ("tenant_id", "device_id") REFERENCES "Device"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeviceAudit" ADD CONSTRAINT "DeviceAudit_tenant_id_enrolment_code_id_fkey"
  FOREIGN KEY ("tenant_id", "enrolment_code_id") REFERENCES "EnrolmentCode"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

REVOKE ALL ON "DeviceAudit" FROM "deanpos_app";
GRANT SELECT, INSERT ON "DeviceAudit" TO "deanpos_app";

ALTER TABLE "DeviceAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeviceAudit" FORCE ROW LEVEL SECURITY;
CREATE POLICY "device_audit_tenant_isolation_select" ON "DeviceAudit"
  FOR SELECT USING ("tenant_id" = current_setting('app.tenant_id', true));
CREATE POLICY "device_audit_tenant_isolation_insert" ON "DeviceAudit"
  FOR INSERT WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));
