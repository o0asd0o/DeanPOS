import type { Selectable } from "kysely";

import type { PaymentMethod } from "../db/prisma/generated/types.ts";

type PaymentMethodOutput = {
  id: string;
  tenantId: string;
  name: string;
  kind: "cash" | "recorded";
  active: boolean;
  createdAt: Date;
  storeIds: string[];
};

// Physical `@map`ped columns to the contract's camelCase shape (issue 01's
// convention). `storeIds` is joined separately, never encoded here.
export const toPaymentMethodOutput = (
  method: Selectable<PaymentMethod>,
  storeIds: string[],
): PaymentMethodOutput => ({
  id: method.id,
  tenantId: method.tenant_id,
  name: method.name,
  kind: method.kind,
  active: method.active,
  createdAt: method.created_at,
  storeIds,
});
