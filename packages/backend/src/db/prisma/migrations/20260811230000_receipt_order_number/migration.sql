-- Pre-production migration: historical Orders require a separate sequence bootstrap.
ALTER TABLE "Order"
  ADD COLUMN "device_sequence" INTEGER NOT NULL,
  ADD COLUMN "order_number" TEXT NOT NULL,
  ADD CONSTRAINT "Order_device_sequence_positive" CHECK ("device_sequence" > 0),
  ADD CONSTRAINT "Order_order_number_format" CHECK (
    "order_number" ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ0-9]{2,4}-[0-9]{4,}$'
  );

CREATE UNIQUE INDEX "Order_tenant_id_device_id_device_sequence_key"
  ON "Order"("tenant_id", "device_id", "device_sequence");
