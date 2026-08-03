import type { DatabaseInstance } from "../../../db/client.ts";

// Every created method is `recorded` — there is no `kind` control (record 054
// Q3). `cash` is seeded only by provisioning's own insert.
export const insertPaymentMethod = (
  db: DatabaseInstance,
  values: { id: string; tenantId: string; name: string },
) =>
  db
    .insertInto("PaymentMethod")
    .values({ id: values.id, tenant_id: values.tenantId, name: values.name, kind: "recorded" })
    .returningAll()
    .executeTakeFirstOrThrow();
