-- Additive only: two new columns on Store, both with defaults so every
-- existing row is valid the instant this runs (issue 05).
ALTER TABLE "Store" ADD COLUMN "business_day_start" TEXT NOT NULL DEFAULT '00:00';
ALTER TABLE "Store" ADD COLUMN "table_labels" TEXT[] NOT NULL DEFAULT '{}';
