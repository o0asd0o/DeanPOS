-- Link table joining Variant to ModifierGroup (catalog issue 04, approach B).
-- Editing a group updates every Variant using it, because the link is by reference.
-- Display order is the library sort_order (decision 073 — no sort_position column here).

CREATE TABLE "VariantModifierGroup" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "modifier_group_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariantModifierGroup_pkey" PRIMARY KEY ("id"),
    -- One group linked to one variant at most once per tenant.
    CONSTRAINT "VariantModifierGroup_unique" UNIQUE ("tenant_id", "variant_id", "modifier_group_id")
);

CREATE UNIQUE INDEX "VariantModifierGroup_tenant_id_id_key"
  ON "VariantModifierGroup"("tenant_id", "id");
CREATE INDEX "VariantModifierGroup_tenant_id_idx"
  ON "VariantModifierGroup"("tenant_id");
CREATE INDEX "VariantModifierGroup_variant_id_idx"
  ON "VariantModifierGroup"("tenant_id", "variant_id");
CREATE INDEX "VariantModifierGroup_group_id_idx"
  ON "VariantModifierGroup"("tenant_id", "modifier_group_id");

ALTER TABLE "VariantModifierGroup" ADD CONSTRAINT "VariantModifierGroup_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Composite FK ensures the Variant belongs to this tenant — cross-tenant link is
-- impossible at the database layer (PRD security criterion 5).
ALTER TABLE "VariantModifierGroup" ADD CONSTRAINT "VariantModifierGroup_tenant_variant_fkey"
  FOREIGN KEY ("tenant_id", "variant_id") REFERENCES "Variant"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VariantModifierGroup" ADD CONSTRAINT "VariantModifierGroup_tenant_group_fkey"
  FOREIGN KEY ("tenant_id", "modifier_group_id") REFERENCES "ModifierGroup"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Archive-only: the application role cannot delete catalog history.
REVOKE ALL ON "VariantModifierGroup" FROM "deanpos_app";
GRANT SELECT, INSERT, UPDATE ON "VariantModifierGroup" TO "deanpos_app";

ALTER TABLE "VariantModifierGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VariantModifierGroup" FORCE ROW LEVEL SECURITY;
CREATE POLICY "variant_modifier_group_tenant_isolation" ON "VariantModifierGroup"
  USING ("tenant_id" = current_setting('app.tenant_id', true));
