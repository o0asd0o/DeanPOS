CREATE TABLE "AddOn" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "delta_kind" TEXT NOT NULL,
    "delta_value" INTEGER NOT NULL,
    "maximum" INTEGER,
    "sort_order" INTEGER NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AddOn_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AddOn_delta_kind_check" CHECK ("delta_kind" IN ('absolute', 'multiplier')),
    CONSTRAINT "AddOn_delta_value_check" CHECK (("delta_kind" = 'absolute' AND "delta_value" BETWEEN -100000 AND 100000) OR ("delta_kind" = 'multiplier' AND "delta_value" BETWEEN 1 AND 10000)),
    CONSTRAINT "AddOn_maximum_positive_check" CHECK ("maximum" IS NULL OR "maximum" > 0)
);

CREATE TABLE "MenuItemAddOn" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "add_on_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItemAddOn_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MenuItemAddOn_unique" UNIQUE ("tenant_id", "menu_item_id", "add_on_id")
);

CREATE UNIQUE INDEX "AddOn_tenant_id_id_key" ON "AddOn"("tenant_id", "id");
CREATE INDEX "AddOn_tenant_id_idx" ON "AddOn"("tenant_id");
CREATE UNIQUE INDEX "AddOn_active_sort_order_key" ON "AddOn"("tenant_id", "sort_order") WHERE "archived_at" IS NULL;
CREATE UNIQUE INDEX "AddOn_active_name_key" ON "AddOn"("tenant_id", "name") WHERE "archived_at" IS NULL;
CREATE UNIQUE INDEX "MenuItemAddOn_tenant_id_id_key" ON "MenuItemAddOn"("tenant_id", "id");
CREATE INDEX "MenuItemAddOn_tenant_id_idx" ON "MenuItemAddOn"("tenant_id");
CREATE INDEX "MenuItemAddOn_menu_item_id_idx" ON "MenuItemAddOn"("tenant_id", "menu_item_id");
CREATE INDEX "MenuItemAddOn_add_on_id_idx" ON "MenuItemAddOn"("tenant_id", "add_on_id");

ALTER TABLE "AddOn" ADD CONSTRAINT "AddOn_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItemAddOn" ADD CONSTRAINT "MenuItemAddOn_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItemAddOn" ADD CONSTRAINT "MenuItemAddOn_tenant_menu_item_fkey" FOREIGN KEY ("tenant_id", "menu_item_id") REFERENCES "MenuItem"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItemAddOn" ADD CONSTRAINT "MenuItemAddOn_tenant_add_on_fkey" FOREIGN KEY ("tenant_id", "add_on_id") REFERENCES "AddOn"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

REVOKE ALL ON "AddOn" FROM "deanpos_app";
GRANT SELECT, INSERT, UPDATE ON "AddOn" TO "deanpos_app";
REVOKE ALL ON "MenuItemAddOn" FROM "deanpos_app";
GRANT SELECT, INSERT, UPDATE ON "MenuItemAddOn" TO "deanpos_app";

ALTER TABLE "AddOn" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AddOn" FORCE ROW LEVEL SECURITY;
CREATE POLICY "add_on_tenant_isolation" ON "AddOn" USING ("tenant_id" = current_setting('app.tenant_id', true));
ALTER TABLE "MenuItemAddOn" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MenuItemAddOn" FORCE ROW LEVEL SECURITY;
CREATE POLICY "menu_item_add_on_tenant_isolation" ON "MenuItemAddOn" USING ("tenant_id" = current_setting('app.tenant_id', true));
