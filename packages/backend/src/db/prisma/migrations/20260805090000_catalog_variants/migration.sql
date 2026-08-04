-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_centavos" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Variant_tenant_id_id_key" ON "Variant"("tenant_id", "id");
CREATE INDEX "Variant_tenant_id_idx" ON "Variant"("tenant_id");
CREATE INDEX "Variant_tenant_id_menu_item_id_idx" ON "Variant"("tenant_id", "menu_item_id");
CREATE UNIQUE INDEX "Variant_active_sort_order_key"
  ON "Variant"("tenant_id", "menu_item_id", "sort_order") WHERE "archived_at" IS NULL;
CREATE UNIQUE INDEX "Variant_active_name_key"
  ON "Variant"("tenant_id", "menu_item_id", "name") WHERE "archived_at" IS NULL;

ALTER TABLE "Variant" ADD CONSTRAINT "Variant_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_tenant_id_menu_item_id_fkey"
  FOREIGN KEY ("tenant_id", "menu_item_id") REFERENCES "MenuItem"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Archive-only: the application role cannot delete catalog history.
REVOKE ALL ON "Variant" FROM "deanpos_app";
GRANT SELECT, INSERT, UPDATE ON "Variant" TO "deanpos_app";

ALTER TABLE "Variant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Variant" FORCE ROW LEVEL SECURITY;
CREATE POLICY "variant_tenant_isolation" ON "Variant"
  USING ("tenant_id" = current_setting('app.tenant_id', true));
