-- VariantModifierGroup links are junction records, not catalog history.
-- Removing a link when a group is archived or unlinked is a legitimate operation.
-- The original migration only granted SELECT, INSERT, UPDATE — this fixes that.
GRANT DELETE ON "VariantModifierGroup" TO "deanpos_app";
