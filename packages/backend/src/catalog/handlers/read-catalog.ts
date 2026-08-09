import { catalogReadInputSchema, type catalogReadOutputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { catalogVersion } from "../db-operations/queries/catalog-version.query.ts";
import { listActiveCategories } from "../db-operations/queries/list-active-categories.query.ts";
import { listActiveVariantsForMenuItem } from "../../variant/db-operations/queries/list-active-variants-for-menu-item.query.ts";
import { listSellableMenuItems } from "../db-operations/queries/list-sellable-menu-items.query.ts";
import { listLinkedModifierGroupsForItem } from "../db-operations/queries/list-linked-modifier-groups-for-item.query.ts";
import { listActiveModifiersForGroup } from "../../modifier/db-operations/queries/list-modifiers-for-group.query.ts";
import { toCategoryOutput } from "../helpers.ts";
import { deltaFromStored } from "../../modifier/delta.ts";
import { listLinkedAddOnsForItem } from "../db-operations/queries/list-linked-add-ons-for-item.query.ts";
import { listCurrentDiscounts } from "../../discount/db-operations/queries/list-current-discounts.query.ts";
import { toDiscountReadShape } from "../../discount/helpers.ts";
import { getStore } from "../../store/db-operations/queries/get-store.query.ts";
import { canAccessStore } from "../../common/authorize.ts";
import { sql } from "../../db/client.ts";

export const inputSchema = catalogReadInputSchema;
type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof catalogReadOutputSchema>;

export const handler: Handler<Input, Output> = async ({ ctx, input }) => {
  const tenantId =
    ctx.kind === "tenant"
      ? ctx.principal.tenantId
      : ctx.kind === "device"
        ? ctx.device.tenantId
        : null;
  if (!tenantId) {
    return { categories: [], menuItems: [], discounts: [], version: "0".repeat(64) };
  }

  return withTenantScope(ctx.db, tenantId, async (db) => {
    const store = await getStore(db, input.storeId);
    const authorized =
      ctx.kind === "device"
        ? ctx.device.storeId === input.storeId
        : ctx.kind === "tenant"
          ? !!ctx.principal.userId &&
            !!ctx.principal.role &&
            (await canAccessStore(db, ctx.principal.userId, ctx.principal.role, input.storeId))
          : false;
    if (!store || !authorized)
      return { categories: [], menuItems: [], discounts: [], version: "0".repeat(64) };
    const [variantRows, itemRows] = await Promise.all([
      sql<{
        id: string;
      }>`select variant_id id from "VariantUnavailability" where store_id=${input.storeId}`.execute(
        db,
      ),
      sql<{
        id: string;
      }>`select menu_item_id id from "MenuItemUnavailability" where store_id=${input.storeId}`.execute(
        db,
      ),
    ]);
    const unavailableVariants = new Set(variantRows.rows.map((row) => row.id));
    const unavailableItems = new Set(itemRows.rows.map((row) => row.id));
    const categories = (await listActiveCategories(db)).map(toCategoryOutput);
    const discounts = (await listCurrentDiscounts(db))
      .filter((row) => !row.archived_at)
      .map(toDiscountReadShape);
    const sellable = await listSellableMenuItems(db);
    const toGroupShape = async (group: {
      id: string;
      name: string;
      selection_rule: string;
      maximum: number | null;
      default_modifier_id: string | null;
      sort_order: number;
    }) => {
      const allModifiers = await listActiveModifiersForGroup(db, group.id);
      const modifiers = allModifiers.map((m) => {
        const dr = deltaFromStored(m.delta_kind as "absolute" | "multiplier", m.delta_value);
        return {
          id: m.id,
          name: m.name,
          delta: dr.ok ? dr.delta : { kind: "absolute" as const, amountCentavos: 0 },
          sortOrder: m.sort_order,
        };
      });
      return {
        id: group.id,
        name: group.name,
        selectionRule: group.selection_rule as "required-one" | "optional-one" | "many",
        maximum: group.maximum,
        defaultModifierId: group.default_modifier_id,
        sortOrder: group.sort_order,
        modifiers,
      };
    };

    const menuItems = await Promise.all(
      sellable.map(async (item) => {
        const itemGroups = await listLinkedModifierGroupsForItem(db, item.id);
        const modifierGroups = await Promise.all(itemGroups.map(toGroupShape));
        const addOns = (await listLinkedAddOnsForItem(db, item.id)).map((addOn) => {
          const result = deltaFromStored(
            addOn.delta_kind as "absolute" | "multiplier",
            addOn.delta_value,
          );
          return {
            id: addOn.id,
            name: addOn.name,
            delta: result.ok ? result.delta : { kind: "absolute" as const, amountCentavos: 0 },
            maximum: addOn.maximum,
            sortOrder: addOn.sort_order,
          };
        });

        const variants = await listActiveVariantsForMenuItem(db, item.id);
        const variantsWithGroups = variants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          priceCentavos: variant.price_centavos,
          sortOrder: variant.sort_order,
          available: !unavailableVariants.has(variant.id),
        }));
        return {
          id: item.id,
          tenantId: item.tenant_id,
          categoryId: item.category_id,
          name: item.name,
          priceCentavos: item.price_centavos,
          sortOrder: item.sort_order,
          modifierGroups,
          addOns,
          variants: variantsWithGroups,
          available: !unavailableItems.has(item.id),
        };
      }),
    );
    const version = await catalogVersion(db, tenantId, input.storeId);
    return { categories, menuItems, discounts, version };
  });
};
