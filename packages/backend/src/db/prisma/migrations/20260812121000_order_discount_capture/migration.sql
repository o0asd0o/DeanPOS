ALTER TABLE "Order" ADD COLUMN "discount_id" TEXT;
ALTER TABLE "Order" ADD COLUMN "discount_name" TEXT;
ALTER TABLE "Order" ADD COLUMN "discount_type" TEXT;
ALTER TABLE "Order" ADD COLUMN "discount_value" INTEGER;
ALTER TABLE "Order" ADD COLUMN "discount_scope" TEXT;
ALTER TABLE "Order" ADD COLUMN "discount_vat_exempt" BOOLEAN;
ALTER TABLE "Order" ADD COLUMN "discount_amount_centavos" INTEGER;
ALTER TABLE "Order" ADD CONSTRAINT "Order_discount_capture_check" CHECK (("discount_id" IS NULL) = ("discount_name" IS NULL) AND ("discount_id" IS NULL) = ("discount_type" IS NULL) AND ("discount_id" IS NULL) = ("discount_value" IS NULL) AND ("discount_id" IS NULL) = ("discount_scope" IS NULL) AND ("discount_id" IS NULL) = ("discount_vat_exempt" IS NULL) AND ("discount_id" IS NULL) = ("discount_amount_centavos" IS NULL));
