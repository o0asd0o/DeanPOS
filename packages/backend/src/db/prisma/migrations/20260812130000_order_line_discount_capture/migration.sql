ALTER TABLE "OrderLine" ADD COLUMN "discount_id" TEXT;
ALTER TABLE "OrderLine" ADD COLUMN "discount_name" TEXT;
ALTER TABLE "OrderLine" ADD COLUMN "discount_type" TEXT;
ALTER TABLE "OrderLine" ADD COLUMN "discount_value" INTEGER;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_discount_capture_check" CHECK (
  ("discount_id" IS NULL) = ("discount_name" IS NULL)
  AND ("discount_id" IS NULL) = ("discount_type" IS NULL)
  AND ("discount_id" IS NULL) = ("discount_value" IS NULL)
  AND ("discount_type" IS NULL OR "discount_type" = 'percent')
);
