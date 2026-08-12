import type { DatabaseInstance } from "../../../db/client.ts";
import { sql } from "../../../db/client.ts";
import { jsonArrayFrom, jsonBuildObject } from "kysely/helpers/postgres";
import { selectAvailablePaymentMethods } from "../../../payment-method/db-operations/queries/select-available-payment-methods.query.ts";

const buildCatalogPayload = (db: DatabaseInstance, storeId: string) => {
  const currentDiscounts = db
    .selectFrom("Discount as d")
    .selectAll("d")
    .distinctOn("d.discount_id")
    .orderBy("d.discount_id")
    .orderBy("d.effective_from", "desc")
    .orderBy("d.created_at", "desc");

  return db.selectNoFrom((eb) => [
    jsonBuildObject({
      categories: jsonArrayFrom(
        eb
          .selectFrom("Category as c")
          .select(["c.id", "c.tenant_id as tenantId", "c.name", "c.sort_order as sortOrder"])
          .where("c.archived_at", "is", null)
          .orderBy("c.sort_order")
          .orderBy("c.id"),
      ),
      menuItems: jsonArrayFrom(
        eb
          .selectFrom("MenuItem as m")
          .innerJoin("Category as c", (join) =>
            join.onRef("c.id", "=", "m.category_id").onRef("c.tenant_id", "=", "m.tenant_id"),
          )
          .select((eb) => [
            "m.id",
            "m.tenant_id as tenantId",
            "m.category_id as categoryId",
            "m.name",
            "m.price_centavos as priceCentavos",
            "m.sort_order as sortOrder",
            jsonArrayFrom(
              eb
                .selectFrom("MenuItemModifierGroup as immg")
                .innerJoin("ModifierGroup as mg", (join) =>
                  join
                    .onRef("mg.id", "=", "immg.modifier_group_id")
                    .onRef("mg.tenant_id", "=", "immg.tenant_id"),
                )
                .select((eb) => [
                  "mg.id",
                  "mg.name",
                  "mg.selection_rule as selectionRule",
                  "mg.maximum",
                  "mg.default_modifier_id as defaultModifierId",
                  "mg.sort_order as sortOrder",
                  jsonArrayFrom(
                    eb
                      .selectFrom("Modifier as mo")
                      .select((eb) => [
                        "mo.id",
                        "mo.name",
                        eb
                          .case()
                          .when("mo.delta_kind", "=", "absolute")
                          .then(
                            jsonBuildObject({
                              kind: sql<string>`'absolute'::text`,
                              amountCentavos: eb.ref("mo.delta_value"),
                            }),
                          )
                          .when("mo.delta_kind", "=", "multiplier")
                          .then(
                            jsonBuildObject({
                              kind: sql<string>`'multiplier'::text`,
                              perMille: eb.ref("mo.delta_value"),
                            }),
                          )
                          .end()
                          .as("delta"),
                        "mo.sort_order as sortOrder",
                      ])
                      .whereRef("mo.tenant_id", "=", "mg.tenant_id")
                      .whereRef("mo.group_id", "=", "mg.id")
                      .where("mo.archived_at", "is", null)
                      .orderBy("mo.sort_order")
                      .orderBy("mo.id"),
                  ).as("modifiers"),
                ])
                .whereRef("immg.tenant_id", "=", "m.tenant_id")
                .whereRef("immg.menu_item_id", "=", "m.id")
                .where("mg.archived_at", "is", null)
                .orderBy("mg.sort_order")
                .orderBy("mg.id"),
            ).as("modifierGroups"),
            jsonArrayFrom(
              eb
                .selectFrom("MenuItemAddOn as imao")
                .innerJoin("AddOn as ao", (join) =>
                  join
                    .onRef("ao.id", "=", "imao.add_on_id")
                    .onRef("ao.tenant_id", "=", "imao.tenant_id"),
                )
                .select((eb) => [
                  "ao.id",
                  "ao.name",
                  eb
                    .case()
                    .when("ao.delta_kind", "=", "absolute")
                    .then(
                      jsonBuildObject({
                        kind: sql<string>`'absolute'::text`,
                        amountCentavos: eb.ref("ao.delta_value"),
                      }),
                    )
                    .when("ao.delta_kind", "=", "multiplier")
                    .then(
                      jsonBuildObject({
                        kind: sql<string>`'multiplier'::text`,
                        perMille: eb.ref("ao.delta_value"),
                      }),
                    )
                    .end()
                    .as("delta"),
                  "ao.maximum",
                  "ao.sort_order as sortOrder",
                ])
                .whereRef("imao.tenant_id", "=", "m.tenant_id")
                .whereRef("imao.menu_item_id", "=", "m.id")
                .where("ao.archived_at", "is", null)
                .orderBy("ao.sort_order")
                .orderBy("ao.id"),
            ).as("addOns"),
            jsonArrayFrom(
              eb
                .selectFrom("Variant as v")
                .select((eb) => [
                  "v.id",
                  "v.name",
                  "v.price_centavos as priceCentavos",
                  "v.sort_order as sortOrder",
                  eb
                    .not(
                      eb.exists(
                        eb
                          .selectFrom("VariantUnavailability as vu")
                          .select("vu.variant_id")
                          .whereRef("vu.tenant_id", "=", "v.tenant_id")
                          .whereRef("vu.variant_id", "=", "v.id")
                          .where("vu.store_id", "=", storeId),
                      ),
                    )
                    .as("available"),
                ])
                .whereRef("v.menu_item_id", "=", "m.id")
                .whereRef("v.tenant_id", "=", "m.tenant_id")
                .where("v.archived_at", "is", null)
                .orderBy("v.sort_order")
                .orderBy("v.id"),
            ).as("variants"),
            eb
              .not(
                eb.exists(
                  eb
                    .selectFrom("MenuItemUnavailability as miu")
                    .select("miu.menu_item_id")
                    .whereRef("miu.tenant_id", "=", "m.tenant_id")
                    .whereRef("miu.menu_item_id", "=", "m.id")
                    .where("miu.store_id", "=", storeId),
                ),
              )
              .as("available"),
          ])
          .where("m.archived_at", "is", null)
          .where("c.archived_at", "is", null)
          .orderBy("c.sort_order")
          .orderBy("m.sort_order")
          .orderBy("m.id"),
      ),
      discounts: jsonArrayFrom(
        eb
          .selectFrom(currentDiscounts.as("d"))
          .select([
            "d.id",
            "d.name",
            "d.type",
            "d.scope",
            "d.value",
            "d.requires_override as requiresOverride",
            "d.vat_exempt as vatExempt",
            "d.requires_reference as requiresReference",
            "d.reference_label as referenceLabel",
          ])
          .where("d.archived_at", "is", null)
          .orderBy("d.name")
          .orderBy("d.id"),
      ),
      paymentMethods: jsonArrayFrom(
        selectAvailablePaymentMethods(db, storeId)
          .select(["method.id", "method.name", "method.kind"])
          .orderBy(sql`CASE WHEN method.kind = 'cash' THEN 0 ELSE 1 END`)
          .orderBy("method.name")
          .orderBy("method.id"),
      ),
    }).as("content"),
  ]);
};

const hashOfPayload = sql<string>`
  encode(sha256(convert_to("payload"."content"::jsonb::text, 'UTF8')), 'hex')
`;

export const selectCatalogRead = (db: DatabaseInstance, storeId: string) =>
  db
    .selectFrom(buildCatalogPayload(db, storeId).as("payload"))
    .select(["payload.content", hashOfPayload.as("version")])
    .executeTakeFirstOrThrow();

export const selectCatalogVersion = (db: DatabaseInstance, storeId: string) =>
  db
    .selectFrom(buildCatalogPayload(db, storeId).as("payload"))
    .select(hashOfPayload.as("version"))
    .executeTakeFirstOrThrow()
    .then((row) => row.version);

// Compatibility API for existing hash-only callers. The tenant is established
// by withTenantScope; it is intentionally not part of the payload or hash.
export const catalogVersion = (db: DatabaseInstance, _tenantId: string, storeId: string) =>
  selectCatalogVersion(db, storeId);
