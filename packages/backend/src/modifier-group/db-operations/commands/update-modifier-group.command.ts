import type { DatabaseInstance } from "../../../db/client.ts";

export const updateModifierGroup = (
  db: DatabaseInstance,
  id: string,
  values: {
    name: string;
    selectionRule: string;
    maximum: number | null;
    defaultModifierId: string | null;
  },
) =>
  db
    .updateTable("ModifierGroup")
    .set({
      name: values.name,
      selection_rule: values.selectionRule,
      maximum: values.maximum,
      default_modifier_id: values.defaultModifierId,
    })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
