-- Tenant-level Options library (catalog issue 03). Approach B: groups are not
-- owned by a menu item. Linking to variants is issue 04.

CREATE TABLE "ModifierGroup" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "selection_rule" TEXT NOT NULL,
    "maximum" INTEGER,
    "default_modifier_id" TEXT,
    "sort_order" INTEGER NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModifierGroup_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ModifierGroup_selection_rule_check"
      CHECK ("selection_rule" IN ('required-one', 'optional-one', 'many')),
    -- Scenario 25: many + maximum 0 is configured-looking and unsatisfiable.
    CONSTRAINT "ModifierGroup_many_maximum_check"
      CHECK (NOT ("selection_rule" = 'many' AND "maximum" = 0)),
    -- maximum is only meaningful for many; null means unlimited.
    CONSTRAINT "ModifierGroup_maximum_only_for_many_check"
      CHECK ("maximum" IS NULL OR "selection_rule" = 'many'),
    CONSTRAINT "ModifierGroup_maximum_positive_check"
      CHECK ("maximum" IS NULL OR "maximum" > 0)
);

CREATE TABLE "Modifier" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "delta_kind" TEXT NOT NULL,
    "delta_value" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Modifier_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Modifier_delta_kind_check"
      CHECK ("delta_kind" IN ('absolute', 'multiplier')),
    -- Absolute ±100_000 centavos; multiplier 1..10000 per-mille (issue 03).
    CONSTRAINT "Modifier_delta_value_check"
      CHECK (
        ("delta_kind" = 'absolute' AND "delta_value" BETWEEN -100000 AND 100000)
        OR
        ("delta_kind" = 'multiplier' AND "delta_value" BETWEEN 1 AND 10000)
      )
);

CREATE UNIQUE INDEX "ModifierGroup_tenant_id_id_key" ON "ModifierGroup"("tenant_id", "id");
CREATE INDEX "ModifierGroup_tenant_id_idx" ON "ModifierGroup"("tenant_id");
CREATE UNIQUE INDEX "ModifierGroup_active_sort_order_key"
  ON "ModifierGroup"("tenant_id", "sort_order") WHERE "archived_at" IS NULL;
CREATE UNIQUE INDEX "ModifierGroup_active_name_key"
  ON "ModifierGroup"("tenant_id", "name") WHERE "archived_at" IS NULL;

CREATE UNIQUE INDEX "Modifier_tenant_id_id_key" ON "Modifier"("tenant_id", "id");
CREATE INDEX "Modifier_tenant_id_idx" ON "Modifier"("tenant_id");
CREATE INDEX "Modifier_tenant_id_group_id_idx" ON "Modifier"("tenant_id", "group_id");
CREATE UNIQUE INDEX "Modifier_active_sort_order_key"
  ON "Modifier"("tenant_id", "group_id", "sort_order") WHERE "archived_at" IS NULL;
CREATE UNIQUE INDEX "Modifier_active_name_key"
  ON "Modifier"("tenant_id", "group_id", "name") WHERE "archived_at" IS NULL;

ALTER TABLE "ModifierGroup" ADD CONSTRAINT "ModifierGroup_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Modifier" ADD CONSTRAINT "Modifier_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Modifier" ADD CONSTRAINT "Modifier_tenant_id_group_id_fkey"
  FOREIGN KEY ("tenant_id", "group_id") REFERENCES "ModifierGroup"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Default modifier is optional; when set it must be a Modifier in this tenant.
ALTER TABLE "ModifierGroup" ADD CONSTRAINT "ModifierGroup_default_modifier_fkey"
  FOREIGN KEY ("tenant_id", "default_modifier_id") REFERENCES "Modifier"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Archive-only: the application role cannot delete catalog history.
REVOKE ALL ON "ModifierGroup" FROM "deanpos_app";
GRANT SELECT, INSERT, UPDATE ON "ModifierGroup" TO "deanpos_app";
REVOKE ALL ON "Modifier" FROM "deanpos_app";
GRANT SELECT, INSERT, UPDATE ON "Modifier" TO "deanpos_app";

ALTER TABLE "ModifierGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ModifierGroup" FORCE ROW LEVEL SECURITY;
CREATE POLICY "modifier_group_tenant_isolation" ON "ModifierGroup"
  USING ("tenant_id" = current_setting('app.tenant_id', true));

ALTER TABLE "Modifier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Modifier" FORCE ROW LEVEL SECURITY;
CREATE POLICY "modifier_tenant_isolation" ON "Modifier"
  USING ("tenant_id" = current_setting('app.tenant_id', true));
