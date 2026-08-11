CREATE TABLE "Order" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "drawer_session_id" TEXT,
  "status" TEXT NOT NULL,
  "total_centavos" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Order_status_check" CHECK ("status" = 'paid'),
  CONSTRAINT "Order_total_centavos_check" CHECK ("total_centavos" >= 0)
);

CREATE UNIQUE INDEX "Order_tenant_id_id_key" ON "Order"("tenant_id", "id");
CREATE INDEX "Order_tenant_id_idx" ON "Order"("tenant_id");
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenant_id_store_id_fkey"
  FOREIGN KEY ("tenant_id", "store_id") REFERENCES "Store"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenant_id_device_id_fkey"
  FOREIGN KEY ("tenant_id", "device_id") REFERENCES "Device"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OrderLine" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "menu_item_id" TEXT NOT NULL,
  "menu_item_name" TEXT NOT NULL,
  "variant_id" TEXT,
  "variant_name" TEXT NOT NULL,
  "unit_price_centavos" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "line_total_centavos" INTEGER NOT NULL,
  "modifier_snapshot" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "addon_snapshot" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "sort_order" INTEGER NOT NULL,
  CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderLine_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "OrderLine_unit_price_centavos_check" CHECK ("unit_price_centavos" >= 0),
  CONSTRAINT "OrderLine_line_total_centavos_check" CHECK ("line_total_centavos" >= 0)
);

CREATE UNIQUE INDEX "OrderLine_tenant_id_id_key" ON "OrderLine"("tenant_id", "id");
CREATE INDEX "OrderLine_tenant_id_idx" ON "OrderLine"("tenant_id");
CREATE INDEX "OrderLine_tenant_id_order_id_idx" ON "OrderLine"("tenant_id", "order_id");
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_tenant_id_order_id_fkey"
  FOREIGN KEY ("tenant_id", "order_id") REFERENCES "Order"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "payment_method_id" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "amount_tendered_centavos" INTEGER NOT NULL,
  "change_centavos" INTEGER NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_method_check" CHECK ("method" = 'cash'),
  CONSTRAINT "Payment_amount_tendered_centavos_check" CHECK ("amount_tendered_centavos" >= 0),
  CONSTRAINT "Payment_change_centavos_check" CHECK ("change_centavos" >= 0)
);

CREATE UNIQUE INDEX "Payment_tenant_id_id_key" ON "Payment"("tenant_id", "id");
CREATE UNIQUE INDEX "Payment_tenant_id_order_id_key" ON "Payment"("tenant_id", "order_id");
CREATE INDEX "Payment_tenant_id_idx" ON "Payment"("tenant_id");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenant_id_order_id_fkey"
  FOREIGN KEY ("tenant_id", "order_id") REFERENCES "Order"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenant_id_payment_method_id_fkey"
  FOREIGN KEY ("tenant_id", "payment_method_id") REFERENCES "PaymentMethod"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

REVOKE ALL ON "Order", "OrderLine", "Payment" FROM "deanpos_app";
GRANT SELECT, INSERT ON "Order", "OrderLine", "Payment" TO "deanpos_app";

ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" FORCE ROW LEVEL SECURITY;
CREATE POLICY "order_tenant_isolation_select" ON "Order"
  FOR SELECT USING ("tenant_id" = current_setting('app.tenant_id', true));
CREATE POLICY "order_tenant_isolation_insert" ON "Order"
  FOR INSERT WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "OrderLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY "order_line_tenant_isolation_select" ON "OrderLine"
  FOR SELECT USING ("tenant_id" = current_setting('app.tenant_id', true));
CREATE POLICY "order_line_tenant_isolation_insert" ON "OrderLine"
  FOR INSERT WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;
CREATE POLICY "payment_tenant_isolation_select" ON "Payment"
  FOR SELECT USING ("tenant_id" = current_setting('app.tenant_id', true));
CREATE POLICY "payment_tenant_isolation_insert" ON "Payment"
  FOR INSERT WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));
