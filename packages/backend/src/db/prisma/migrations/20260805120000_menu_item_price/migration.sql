-- Add price_centavos to MenuItem. Backfill from the first active Variant
-- (by sort_order) where one exists; default to 0 for items with no variant.
ALTER TABLE "MenuItem" ADD COLUMN "price_centavos" INTEGER NOT NULL DEFAULT 0;

UPDATE "MenuItem" m
SET "price_centavos" = sub."price_centavos"
FROM (
  SELECT DISTINCT ON (v."tenant_id", v."menu_item_id")
    v."tenant_id", v."menu_item_id", v."price_centavos"
  FROM "Variant" v
  WHERE v."archived_at" IS NULL
  ORDER BY v."tenant_id", v."menu_item_id", v."sort_order"
) sub
WHERE m."id" = sub."menu_item_id"
  AND m."tenant_id" = sub."tenant_id";

-- Drop the default now that backfill is done.
ALTER TABLE "MenuItem" ALTER COLUMN "price_centavos" DROP DEFAULT;
