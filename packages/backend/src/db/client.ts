import { Kysely, PostgresDialect } from "kysely";
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
