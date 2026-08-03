import type { DatabaseInstance } from "../../../db/client.ts";

// RLS already confines this to the caller's own Tenant (issue 01).
// Deterministic order: creation time, then id to break ties.
export const listPaymentMethods = (db: DatabaseInstance) =>
  db
    .selectFrom("PaymentMethod")
    .selectAll()
    .orderBy("created_at", "asc")
    .orderBy("id", "asc")
    .execute();
