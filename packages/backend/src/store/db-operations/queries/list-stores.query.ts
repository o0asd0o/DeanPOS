import type { DatabaseInstance } from "../../../db/client.ts";

// RLS already confines this to the caller's own Tenant (issue 01); role- and
// membership-based narrowing for a `manager` happens in the handler, not here.
// Deterministic order (finding 9): creation time, then id to break ties.
export const listStores = (db: DatabaseInstance) =>
  db.selectFrom("Store").selectAll().orderBy("createdAt", "asc").orderBy("id", "asc").execute();
