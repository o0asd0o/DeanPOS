import type { Selectable } from "kysely";

import type { Category, MenuItem } from "../db/prisma/generated/types.ts";

export const toCategoryOutput = (category: Selectable<Category>) => ({
  id: category.id,
  tenantId: category.tenant_id,
  name: category.name,
  sortOrder: category.sort_order,
  archivedAt: category.archived_at,
  createdAt: category.created_at,
});

export const toMenuItemOutput = (menuItem: Selectable<MenuItem>) => ({
  id: menuItem.id,
  tenantId: menuItem.tenant_id,
  name: menuItem.name,
  priceCentavos: menuItem.price_centavos,
  sortOrder: menuItem.sort_order,
  archivedAt: menuItem.archived_at,
  createdAt: menuItem.created_at,
  categoryId: menuItem.category_id,
});
