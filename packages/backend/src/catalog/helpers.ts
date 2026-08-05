import type { Selectable } from "kysely";

import type {
  Category,
  MenuItem,
  Modifier,
  ModifierGroup,
  Variant,
} from "../db/prisma/generated/types.ts";
import { deltaFromStored } from "./delta.ts";

export const toCategoryOutput = (category: Selectable<Category>) => ({
  id: category.id,
  tenantId: category.tenant_id,
  name: category.name,
  sortOrder: category.sort_order,
  archivedAt: category.archived_at,
  createdAt: category.created_at,
});

export const toMenuItemOutput = (menuItem: Selectable<MenuItem>, sellable = false) => ({
  id: menuItem.id,
  tenantId: menuItem.tenant_id,
  name: menuItem.name,
  sortOrder: menuItem.sort_order,
  archivedAt: menuItem.archived_at,
  createdAt: menuItem.created_at,
  categoryId: menuItem.category_id,
  sellable,
});

export const toVariantOutput = (variant: Selectable<Variant>) => ({
  id: variant.id,
  tenantId: variant.tenant_id,
  menuItemId: variant.menu_item_id,
  name: variant.name,
  priceCentavos: variant.price_centavos,
  sortOrder: variant.sort_order,
  archivedAt: variant.archived_at,
  createdAt: variant.created_at,
});

export const toModifierOutput = (modifier: Selectable<Modifier>) => {
  const deltaResult = deltaFromStored(
    modifier.delta_kind as "absolute" | "multiplier",
    modifier.delta_value,
  );
  if (!deltaResult.ok) {
    throw new Error(`stored modifier delta failed validation: ${deltaResult.error}`);
  }
  return {
    id: modifier.id,
    tenantId: modifier.tenant_id,
    groupId: modifier.group_id,
    name: modifier.name,
    delta: deltaResult.delta,
    sortOrder: modifier.sort_order,
    archivedAt: modifier.archived_at,
    createdAt: modifier.created_at,
  };
};

export const toModifierGroupOutput = (
  group: Selectable<ModifierGroup>,
  modifiers: Selectable<Modifier>[] = [],
  linkedToCount = 0,
) => ({
  id: group.id,
  tenantId: group.tenant_id,
  name: group.name,
  selectionRule: group.selection_rule as "required-one" | "optional-one" | "many",
  maximum: group.maximum,
  defaultModifierId: group.default_modifier_id,
  sortOrder: group.sort_order,
  archivedAt: group.archived_at,
  createdAt: group.created_at,
  linkedToCount,
  modifiers: modifiers.map(toModifierOutput),
});
