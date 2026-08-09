CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "discount_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "value" INTEGER,
    "requires_override" BOOLEAN NOT NULL,
    "vat_exempt" BOOLEAN NOT NULL,
    "requires_reference" BOOLEAN NOT NULL,
    "reference_label" TEXT,
    "archived_at" TIMESTAMP(3),
    "effective_from" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Discount_type_check" CHECK ("type" IN ('percent', 'amount')),
    CONSTRAINT "Discount_scope_check" CHECK ("scope" IN ('order', 'line')),
    CONSTRAINT "Discount_amount_scope_check" CHECK ("type" <> 'amount' OR "scope" = 'order'),
    CONSTRAINT "Discount_percent_value_check" CHECK ("type" <> 'percent' OR "value" IS NULL OR "value" BETWEEN 1 AND 10000),
    CONSTRAINT "Discount_amount_value_check" CHECK ("type" <> 'amount' OR "value" IS NULL OR "value" > 0),
    CONSTRAINT "Discount_reference_check" CHECK (NOT "requires_reference" OR ("reference_label" IS NOT NULL AND length(trim("reference_label")) > 0))
);

CREATE TABLE "DiscountAudit" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "discount_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscountAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Discount_tenant_id_id_key" ON "Discount"("tenant_id", "id");
CREATE INDEX "Discount_tenant_id_idx" ON "Discount"("tenant_id");
CREATE INDEX "Discount_tenant_id_discount_id_idx" ON "Discount"("tenant_id", "discount_id");
CREATE UNIQUE INDEX "Discount_discount_id_effective_from_key" ON "Discount"("discount_id", "effective_from");
CREATE INDEX "DiscountAudit_tenant_id_idx" ON "DiscountAudit"("tenant_id");
CREATE INDEX "DiscountAudit_tenant_id_discount_id_idx" ON "DiscountAudit"("tenant_id", "discount_id");

ALTER TABLE "Discount" ADD CONSTRAINT "Discount_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscountAudit" ADD CONSTRAINT "DiscountAudit_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscountAudit" ADD CONSTRAINT "DiscountAudit_tenant_actor_fkey" FOREIGN KEY ("tenant_id", "actor_user_id") REFERENCES "User"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

REVOKE ALL ON "Discount" FROM "deanpos_app";
GRANT SELECT, INSERT ON "Discount" TO "deanpos_app";
REVOKE ALL ON "DiscountAudit" FROM "deanpos_app";
GRANT SELECT, INSERT ON "DiscountAudit" TO "deanpos_app";

ALTER TABLE "Discount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Discount" FORCE ROW LEVEL SECURITY;
CREATE POLICY "discount_tenant_isolation" ON "Discount"
    USING ("tenant_id" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));
ALTER TABLE "DiscountAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiscountAudit" FORCE ROW LEVEL SECURITY;
CREATE POLICY "discount_audit_tenant_isolation" ON "DiscountAudit"
    USING ("tenant_id" = current_setting('app.tenant_id', true))
    WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));
