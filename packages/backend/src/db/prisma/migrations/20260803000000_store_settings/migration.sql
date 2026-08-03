-- Additive only: two new columns on Store, both with defaults so every
-- existing row is valid the instant this runs (issue 05).
ALTER TABLE "Store" ADD COLUMN "business_day_start" TEXT NOT NULL DEFAULT '00:00';
ALTER TABLE "Store" ADD COLUMN "table_labels" TEXT[] NOT NULL DEFAULT '{}';

-- The schema alone is not the authority (finding 6): HH:mm, 00:00-23:59.
ALTER TABLE "Store" ADD CONSTRAINT "Store_business_day_start_check"
  CHECK ("business_day_start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
