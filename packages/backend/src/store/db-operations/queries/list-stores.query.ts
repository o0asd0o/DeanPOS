import type { DatabaseInstance } from "../../../db/client.ts";

// RLS already confines this to the caller's own Tenant (issue 01); role- and
// membership-based narrowing for a `manager` happens in the handler, not here.
export const listStores = (db: DatabaseInstance) => db.selectFrom("Store").selectAll().execute();
