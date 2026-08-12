ALTER TABLE "Payment" ADD COLUMN "method_name" TEXT;

UPDATE "Payment" AS payment
SET "method_name" = method.name
FROM "PaymentMethod" AS method
WHERE method."tenant_id" = payment."tenant_id"
  AND method."id" = payment."payment_method_id";

ALTER TABLE "Payment" ALTER COLUMN "method_name" SET NOT NULL;
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_method_check";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_method_check"
  CHECK ("method" IN ('cash', 'recorded'));
