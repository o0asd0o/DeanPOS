import type { Selectable } from "kysely";

import type { Modifier, ModifierGroup } from "../db/prisma/generated/types.ts";
import { toModifierOutput } from "../modifier/helpers.ts";

export function normalizeMaximum(
  selectionRule: "required-one" | "optional-one" | "many",
  maximum: number | null | undefined,
): number | null {
  if (selectionRule !== "many") return null;
  return maximum ?? null;
}

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
