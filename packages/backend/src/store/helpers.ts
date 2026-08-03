import type { Selectable } from "kysely";

import type { Store } from "../db/prisma/generated/types.ts";

type StoreOutput = {
  id: string;
  tenantId: string;
  name: string;
  businessDayStart: string;
  tableLabels: string[];
  active: boolean;
  createdAt: Date;
};

// "tenant_id" / "business_day_start" / "table_labels" (schema.prisma @map)
// are the physical columns; the contract's response shape stays camelCase
// (issue 01, findings on the tenant_id rename). Every Store handler routes
// its row through this one mapper.
export const toStoreOutput = (store: Selectable<Store>): StoreOutput => ({
  id: store.id,
  tenantId: store.tenant_id,
  name: store.name,
  businessDayStart: store.business_day_start,
  tableLabels: store.table_labels,
  active: store.active,
  createdAt: store.createdAt,
});
