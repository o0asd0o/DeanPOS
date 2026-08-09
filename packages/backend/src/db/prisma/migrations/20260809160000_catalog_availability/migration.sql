CREATE TABLE "VariantUnavailability" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VariantUnavailability_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VariantUnavailability_variant_id_store_id_key" ON "VariantUnavailability"("variant_id", "store_id");
CREATE INDEX "VariantUnavailability_tenant_id_idx" ON "VariantUnavailability"("tenant_id");
ALTER TABLE "VariantUnavailability" ADD CONSTRAINT "VariantUnavailability_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VariantUnavailability" ADD CONSTRAINT "VariantUnavailability_tenant_id_variant_id_fkey" FOREIGN KEY ("tenant_id", "variant_id") REFERENCES "Variant"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VariantUnavailability" ADD CONSTRAINT "VariantUnavailability_tenant_id_store_id_fkey" FOREIGN KEY ("tenant_id", "store_id") REFERENCES "Store"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VariantUnavailability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VariantUnavailability" FORCE ROW LEVEL SECURITY;
CREATE POLICY "variant_unavailability_tenant_isolation" ON "VariantUnavailability" USING ("tenant_id" = current_setting('app.tenant_id', true));

CREATE TABLE "MenuItemUnavailability" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MenuItemUnavailability_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MenuItemUnavailability_menu_item_id_store_id_key" ON "MenuItemUnavailability"("menu_item_id", "store_id");
CREATE INDEX "MenuItemUnavailability_tenant_id_idx" ON "MenuItemUnavailability"("tenant_id");
ALTER TABLE "MenuItemUnavailability" ADD CONSTRAINT "MenuItemUnavailability_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItemUnavailability" ADD CONSTRAINT "MenuItemUnavailability_tenant_id_menu_item_id_fkey" FOREIGN KEY ("tenant_id", "menu_item_id") REFERENCES "MenuItem"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItemUnavailability" ADD CONSTRAINT "MenuItemUnavailability_tenant_id_store_id_fkey" FOREIGN KEY ("tenant_id", "store_id") REFERENCES "Store"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItemUnavailability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MenuItemUnavailability" FORCE ROW LEVEL SECURITY;
CREATE POLICY "menu_item_unavailability_tenant_isolation" ON "MenuItemUnavailability" USING ("tenant_id" = current_setting('app.tenant_id', true));
