import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";

import type { DB } from "./prisma/generated/types.ts";

export type DatabaseInstance = Kysely<DB>;

// Single connection choke point (ADR-0008); the tenant `set_config` transaction-local
// guard goes here and nowhere else (.scratch/decisions/004-postgres-driver.md).
export const createDb = ({ databaseUrl }: { databaseUrl: string }): DatabaseInstance => {
  const dialect = new PostgresDialect({
    pool: new Pool({ connectionString: databaseUrl, max: 10 }),
  });

  return new Kysely<DB>({ dialect });
};

// The only place `app.tenant_id` is ever set (issue 01, tenant-isolation-spine).
// `set_config(..., true)` is transaction-local — record 004 — so a connection
// returned to the pool at the end of `fn` carries no tenant into the next
// request. `tenantId: null` opens the transaction without setting it, which is
// how the wrong-tenant probe proves RLS denies by default rather than by filter.
export const withTenantScope = <T>(
  db: DatabaseInstance,
  tenantId: string | null,
  fn: (scopedDb: DatabaseInstance) => Promise<T>,
): Promise<T> =>
  db.transaction().execute(async (trx) => {
    if (tenantId !== null) {
      await sql`select set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
    }
    return fn(trx);
  });
