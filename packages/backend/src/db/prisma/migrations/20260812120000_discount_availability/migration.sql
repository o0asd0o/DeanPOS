CREATE TABLE "DiscountAvailability" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "discount_version_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscountAvailability_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiscountAvailability_discount_version_id_store_id_key" ON "DiscountAvailability"("discount_version_id", "store_id");
CREATE INDEX "DiscountAvailability_tenant_id_idx" ON "DiscountAvailability"("tenant_id");
ALTER TABLE "DiscountAvailability" ADD CONSTRAINT "DiscountAvailability_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscountAvailability" ADD CONSTRAINT "DiscountAvailability_tenant_discount_fkey" FOREIGN KEY ("tenant_id", "discount_version_id") REFERENCES "Discount"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscountAvailability" ADD CONSTRAINT "DiscountAvailability_tenant_store_fkey" FOREIGN KEY ("tenant_id", "store_id") REFERENCES "Store"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscountAvailability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiscountAvailability" FORCE ROW LEVEL SECURITY;
CREATE POLICY "discount_availability_tenant_isolation" ON "DiscountAvailability" USING ("tenant_id" = current_setting('app.tenant_id', true)) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));
