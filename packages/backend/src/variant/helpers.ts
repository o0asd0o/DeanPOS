import type { Selectable } from "kysely";

import type { Variant } from "../db/prisma/generated/types.ts";

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
