import type { Selectable } from "kysely";

import type { Category, MenuItem, Variant } from "../db/prisma/generated/types.ts";

export const toCategoryOutput = (category: Selectable<Category>) => ({
  id: category.id,
  tenantId: category.tenant_id,
  name: category.name,
  sortOrder: category.sort_order,
  archivedAt: category.archived_at,
  createdAt: category.created_at,
});

export const toMenuItemOutput = (
  menuItem: Selectable<MenuItem>,
  sellable = false,
) => ({
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
