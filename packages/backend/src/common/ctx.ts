import type { DatabaseInstance } from "../db/client.ts";

// The tenant is read from here and nowhere else — never a header, a query
// parameter, a request body, or the hostname (issue 01, tenant-isolation-spine).
export type Principal = { tenantId: string };

// Built per request by apps/api/src/context.ts. ADR-0008. `principal` is
// optional because no authentication exists until issue 03; ping and health
// construct a bare `{ db }` today and keep working.
export type Ctx = {
  db: DatabaseInstance;
  principal?: Principal | null;
};
