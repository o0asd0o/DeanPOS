import type { Selectable } from "kysely";

import type { Modifier } from "../db/prisma/generated/types.ts";
import { deltaFromStored } from "./delta.ts";

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
