ALTER TABLE "Order"
    ADD COLUMN "vat_enabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "vat_rate_percent" INTEGER;

ALTER TABLE "Order"
    ADD CONSTRAINT "Order_vat_capture_check"
    CHECK ((NOT "vat_enabled" AND "vat_rate_percent" IS NULL) OR ("vat_enabled" AND "vat_rate_percent" IS NOT NULL AND "vat_rate_percent" >= 0));
