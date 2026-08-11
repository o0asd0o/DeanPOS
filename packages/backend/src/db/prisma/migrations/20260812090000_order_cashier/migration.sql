-- Historical Orders predate cashier attribution. Keep both snapshot fields null
-- for those rows; every new submit path writes and validates both values.
ALTER TABLE "Order"
  ADD COLUMN "cashier_user_id" TEXT,
  ADD COLUMN "cashier_name" TEXT,
  ADD CONSTRAINT "Order_cashier_snapshot_pair" CHECK (
    ("cashier_user_id" IS NULL AND "cashier_name" IS NULL)
    OR ("cashier_user_id" IS NOT NULL AND "cashier_name" IS NOT NULL)
  ),
  ADD CONSTRAINT "Order_cashier_fkey"
    FOREIGN KEY ("tenant_id", "cashier_user_id")
    REFERENCES "User"("tenant_id", "id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

CREATE INDEX "Order_tenant_id_cashier_user_id_idx"
  ON "Order"("tenant_id", "cashier_user_id");
