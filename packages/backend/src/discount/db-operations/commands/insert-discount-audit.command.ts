import type { DatabaseInstance } from "../../../db/client.ts";

export const insertDiscountAudit = (
  db: DatabaseInstance,
  values: {
    id: string;
    tenantId: string;
    actorUserId: string;
    discountId: string;
    field:
      | "created"
      | "name"
      | "type"
      | "scope"
      | "value"
      | "requiresOverride"
      | "vatExempt"
      | "requiresReference"
      | "referenceLabel"
      | "archived"
      | "reactivated";
  },
) =>
  db
    .insertInto("DiscountAudit")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      actor_user_id: values.actorUserId,
      discount_id: values.discountId,
      field: values.field,
    })
    .execute();
