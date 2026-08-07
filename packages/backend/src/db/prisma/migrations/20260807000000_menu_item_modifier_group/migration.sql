-- Link table joining MenuItem to ModifierGroup directly (decision 075).
-- Modifier groups at this level apply regardless of which Variant is chosen.
-- Display order follows the library sort_order (decision 073 — no sort_position column).

CREATE TABLE "MenuItemModifierGroup" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "modifier_group_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItemModifierGroup_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MenuItemModifierGroup_unique" UNIQUE ("tenant_id", "menu_item_id", "modifier_group_id")
);

CREATE UNIQUE INDEX "MenuItemModifierGroup_tenant_id_id_key"
  ON "MenuItemModifierGroup"("tenant_id", "id");
CREATE INDEX "MenuItemModifierGroup_tenant_id_idx"
  ON "MenuItemModifierGroup"("tenant_id");
CREATE INDEX "MenuItemModifierGroup_menu_item_id_idx"
  ON "MenuItemModifierGroup"("tenant_id", "menu_item_id");
CREATE INDEX "MenuItemModifierGroup_group_id_idx"
  ON "MenuItemModifierGroup"("tenant_id", "modifier_group_id");

ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_tenant_menu_item_fkey"
  FOREIGN KEY ("tenant_id", "menu_item_id") REFERENCES "MenuItem"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_tenant_group_fkey"
  FOREIGN KEY ("tenant_id", "modifier_group_id") REFERENCES "ModifierGroup"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

REVOKE ALL ON "MenuItemModifierGroup" FROM "deanpos_app";
GRANT SELECT, INSERT, UPDATE ON "MenuItemModifierGroup" TO "deanpos_app";

ALTER TABLE "MenuItemModifierGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MenuItemModifierGroup" FORCE ROW LEVEL SECURITY;
CREATE POLICY "menu_item_modifier_group_tenant_isolation" ON "MenuItemModifierGroup"
  USING ("tenant_id" = current_setting('app.tenant_id', true));
