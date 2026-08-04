-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenant_id_id_key" ON "Category"("tenant_id", "id");
CREATE INDEX "Category_tenant_id_idx" ON "Category"("tenant_id");
CREATE UNIQUE INDEX "Category_active_sort_order_key"
  ON "Category"("tenant_id", "sort_order") WHERE "archived_at" IS NULL;

CREATE UNIQUE INDEX "MenuItem_tenant_id_id_key" ON "MenuItem"("tenant_id", "id");
CREATE INDEX "MenuItem_tenant_id_idx" ON "MenuItem"("tenant_id");
CREATE INDEX "MenuItem_tenant_id_category_id_idx" ON "MenuItem"("tenant_id", "category_id");
CREATE UNIQUE INDEX "MenuItem_active_sort_order_key"
  ON "MenuItem"("tenant_id", "category_id", "sort_order") WHERE "archived_at" IS NULL;

-- Composite foreign keys prevent a child from crossing Tenant boundaries.
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_tenant_id_category_id_fkey"
  FOREIGN KEY ("tenant_id", "category_id") REFERENCES "Category"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Archive-only: the application role cannot delete catalog history.
REVOKE ALL ON "Category" FROM "deanpos_app";
GRANT SELECT, INSERT, UPDATE ON "Category" TO "deanpos_app";
REVOKE ALL ON "MenuItem" FROM "deanpos_app";
GRANT SELECT, INSERT, UPDATE ON "MenuItem" TO "deanpos_app";

ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" FORCE ROW LEVEL SECURITY;
CREATE POLICY "category_tenant_isolation" ON "Category"
  USING ("tenant_id" = current_setting('app.tenant_id', true));
ALTER TABLE "MenuItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MenuItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY "menu_item_tenant_isolation" ON "MenuItem"
  USING ("tenant_id" = current_setting('app.tenant_id', true));
