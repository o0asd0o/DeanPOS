import type { DatabaseInstance } from "../../../db/client.ts";

export const insertModifierGroup = (
  db: DatabaseInstance,
  values: {
    id: string;
    tenantId: string;
    name: string;
    selectionRule: string;
    maximum: number | null;
    sortOrder: number;
  },
) =>
  db
    .insertInto("ModifierGroup")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      name: values.name,
      selection_rule: values.selectionRule,
      maximum: values.maximum,
      default_modifier_id: null,
      sort_order: values.sortOrder,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
