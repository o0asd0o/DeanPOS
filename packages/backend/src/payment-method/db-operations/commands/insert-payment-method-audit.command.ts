import type { DatabaseInstance } from "../../../db/client.ts";

// One row per changed pair, never one row per save (record 054 Q1).
// `storeId` null is a change to the method itself; non-null is availability
// at that Store. `oldValue`/`newValue` are text, stringified with `String()`.
export const insertPaymentMethodAudit = (
  db: DatabaseInstance,
  values: {
    id: string;
    tenantId: string;
    actorUserId: string;
    paymentMethodId: string;
    storeId: string | null;
    field: "created" | "name" | "active" | "available";
    oldValue: string | null;
    newValue: string;
  },
) =>
  db
    .insertInto("PaymentMethodAudit")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      actor_user_id: values.actorUserId,
      payment_method_id: values.paymentMethodId,
      store_id: values.storeId,
      field: values.field,
      old_value: values.oldValue,
      new_value: values.newValue,
    })
    .execute();
