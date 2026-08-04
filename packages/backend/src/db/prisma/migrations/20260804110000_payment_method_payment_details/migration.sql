-- CreateTable
CREATE TABLE "PaymentMethodPaymentDetails" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "payment_method_id" TEXT NOT NULL,
    "store_id" TEXT,
    "account_name" TEXT,
    "account_number" TEXT,
    "image_bytes" BYTEA,
    "image_mime" TEXT,
    "image_sha256" TEXT,
    "image_byte_length" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethodPaymentDetails_pkey" PRIMARY KEY ("id")
);

-- The four image columns are all null (no image) or all set (record 066
-- Q6's hash triple plus the bytes) — never a partial row a `!` read would
-- turn into `data:null;base64,…`.
ALTER TABLE "PaymentMethodPaymentDetails" ADD CONSTRAINT "PaymentMethodPaymentDetails_image_columns_together_check"
  CHECK (
    ("image_bytes" IS NULL) = ("image_mime" IS NULL)
    AND ("image_bytes" IS NULL) = ("image_sha256" IS NULL)
    AND ("image_bytes" IS NULL) = ("image_byte_length" IS NULL)
  );

CREATE INDEX "PaymentMethodPaymentDetails_tenant_id_idx" ON "PaymentMethodPaymentDetails"("tenant_id");

-- `NULL` does not deduplicate under a plain composite unique (issue 14,
-- record 066's first database trap): two partial indexes, one default row
-- per method and one row per (method, Store).
CREATE UNIQUE INDEX "PaymentMethodPaymentDetails_one_default_per_method"
  ON "PaymentMethodPaymentDetails"("payment_method_id") WHERE "store_id" IS NULL;
CREATE UNIQUE INDEX "PaymentMethodPaymentDetails_one_override_per_method_store"
  ON "PaymentMethodPaymentDetails"("payment_method_id", "store_id") WHERE "store_id" IS NOT NULL;

-- Composite FKs, not plain ones — the same cross-tenant trap issue 04 found.
ALTER TABLE "PaymentMethodPaymentDetails" ADD CONSTRAINT "PaymentMethodPaymentDetails_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentMethodPaymentDetails" ADD CONSTRAINT "PaymentMethodPaymentDetails_tenant_id_payment_method_id_fkey"
  FOREIGN KEY ("tenant_id", "payment_method_id") REFERENCES "PaymentMethod"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentMethodPaymentDetails" ADD CONSTRAINT "PaymentMethodPaymentDetails_tenant_id_store_id_fkey"
  FOREIGN KEY ("tenant_id", "store_id") REFERENCES "Store"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Current state only, full CRUD via the default-privileges rule (issue 01's
-- tenant_isolation_spine) — same as PaymentMethodAvailability, no explicit GRANT.
ALTER TABLE "PaymentMethodPaymentDetails" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentMethodPaymentDetails" FORCE ROW LEVEL SECURITY;
CREATE POLICY "payment_method_payment_details_tenant_isolation" ON "PaymentMethodPaymentDetails"
  USING ("tenant_id" = current_setting('app.tenant_id', true));

-- `cash` is money in a drawer and has no account to pay into (issue 14,
-- record 066's second database trap) — a trigger, not a handler check,
-- for the same reason issue 08's cash-immutability trigger exists.
CREATE FUNCTION payment_method_payment_details_refuses_cash() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "PaymentMethod"
    WHERE "tenant_id" = NEW."tenant_id"
      AND "id" = NEW."payment_method_id"
      AND "kind" = 'cash'
  ) THEN
    RAISE EXCEPTION 'cash payment method cannot hold payment details';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_method_payment_details_refuses_cash
  BEFORE INSERT OR UPDATE ON "PaymentMethodPaymentDetails"
  FOR EACH ROW EXECUTE FUNCTION payment_method_payment_details_refuses_cash();

-- Widens the append-only audit's field allow-list to cover the new detail
-- fields (issue 14). Additive: no row is dropped or reinterpreted, and
-- `created_has_no_old_value_check` is untouched.
ALTER TABLE "PaymentMethodAudit" DROP CONSTRAINT "PaymentMethodAudit_field_check";
ALTER TABLE "PaymentMethodAudit" ADD CONSTRAINT "PaymentMethodAudit_field_check"
  CHECK ("field" IN ('created', 'name', 'active', 'available', 'accountName', 'accountNumber', 'image'));

-- `available_has_store_check` forced every non-`available` field to a null
-- `store_id`. A detail field is auditable at Store scope too (issue 14
-- criterion 9), so it is exempted rather than held to `available`'s rule —
-- `available` and every pre-existing field keep exactly their old behaviour.
ALTER TABLE "PaymentMethodAudit" DROP CONSTRAINT "PaymentMethodAudit_available_has_store_check";
ALTER TABLE "PaymentMethodAudit" ADD CONSTRAINT "PaymentMethodAudit_available_has_store_check"
  CHECK (
    "field" IN ('accountName', 'accountNumber', 'image')
    OR (("field" = 'available') = ("store_id" IS NOT NULL))
  );
