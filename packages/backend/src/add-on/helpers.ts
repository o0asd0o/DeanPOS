import type { Selectable } from "kysely";

import type { AddOn } from "../db/prisma/generated/types.ts";
import { deltaFromStored } from "../modifier/delta.ts";

export const toAddOnOutput = (addOn: Selectable<AddOn>, linkedToCount = 0) => {
  const deltaResult = deltaFromStored(
    addOn.delta_kind as "absolute" | "multiplier",
    addOn.delta_value,
  );
  const delta = deltaResult.ok
    ? deltaResult.delta
    : { kind: "absolute" as const, amountCentavos: 0 };
  return {
    id: addOn.id,
    tenantId: addOn.tenant_id,
    name: addOn.name,
    delta,
    maximum: addOn.maximum,
    sortOrder: addOn.sort_order,
    archivedAt: addOn.archived_at,
    createdAt: addOn.created_at,
    linkedToCount,
  };
};
