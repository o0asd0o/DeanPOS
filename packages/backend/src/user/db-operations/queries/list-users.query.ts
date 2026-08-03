import type { DatabaseInstance } from "../../../db/client.ts";

// RLS confines this to the caller's Tenant; role narrowing is the handler's
// job. Ordered by email (record 044 §1), the row identity.
export const listUsers = (db: DatabaseInstance) =>
  db.selectFrom("User").selectAll().orderBy("email", "asc").execute();
