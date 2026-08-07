-- decision 076: modifier groups live on MenuItem only — variants inherit them.
-- VariantModifierGroup is replaced by MenuItemModifierGroup (already live).
DROP TABLE IF EXISTS "VariantModifierGroup" CASCADE;
