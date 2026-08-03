import type { DatabaseInstance } from "../../../db/client.ts";

// RLS confines this to the caller's Tenant; ordered by email (record 044
// §1), the row identity. Explicit column list, never selectAll — this
// feeds the back-office list, which must not carry a credential column.
export const listUsers = (db: DatabaseInstance) =>
  db
    .selectFrom("User")
    .select([
      "id",
      "tenant_id",
      "email",
      "first_name",
      "last_name",
      "must_change_password",
      "role",
      "active",
      "createdAt",
    ])
    .orderBy("email", "asc")
    .execute();
