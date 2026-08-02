import type { DatabaseInstance } from "../db/client.ts";

// The tenant is read from here and nowhere else — never a header, a query
// parameter, a request body, or the hostname (issue 01, tenant-isolation-spine).
export type Principal = { tenantId: string };

// Built once per app instance, not per request (issue 03 moves this). ADR-0008.
// `principal` is optional because no authentication exists yet; ping and
// health construct a bare `{ db }` today and keep working.
export type Ctx = {
  db: DatabaseInstance;
  principal?: Principal | null;
};
