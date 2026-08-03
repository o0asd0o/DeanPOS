import type { DatabaseInstance } from "../../../db/client.ts";

// RLS already confines this to the caller's own Tenant (issue 01); role- and
// membership-based narrowing for a `manager` happens in the handler, not
// here. Ordered by email (record 044 §1) — the row identity, since `User`
// has no name field.
export const listUsers = (db: DatabaseInstance) =>
  db.selectFrom("User").selectAll().orderBy("email", "asc").execute();
