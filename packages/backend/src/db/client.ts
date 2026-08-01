import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import type { DB } from "./prisma/generated/types.ts";

export type DatabaseInstance = Kysely<DB>;

/**
 * The single connection choke point (ADR-0008): every query in every area
 * receives a `Kysely<DB>` from here and never opens one itself. Area 2 sets
 * the tenant session variable in this transaction, and nowhere else, with
 * `set_config('app.tenant_id', $1, true)` — the `true` makes it
 * transaction-local, since a bare `SET` persists on the pooled connection
 * after release and hands the next request another tenant's identity
 * (.scratch/decisions/004-postgres-driver.md).
 */
export const createDb = ({ databaseUrl }: { databaseUrl: string }): DatabaseInstance => {
  const dialect = new PostgresDialect({
    pool: new Pool({ connectionString: databaseUrl, max: 10 }),
  });

  return new Kysely<DB>({ dialect });
};
