import type { DatabaseInstance } from "../../../db/client.ts";

// A row in the effective-dated Store-assignment history (issue 04).
// `assigned: false` is a closing row; the table is append-only, never updated.
export const insertUserStore = (
  db: DatabaseInstance,
  values: {
    id: string;
    tenantId: string;
    userId: string;
    storeId: string;
    assigned: boolean;
    effectiveFrom: Date;
  },
) =>
  db
    .insertInto("UserStore")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      user_id: values.userId,
      store_id: values.storeId,
      assigned: values.assigned,
      effective_from: values.effectiveFrom,
    })
    .execute();
