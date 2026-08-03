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

// The one place any database session variable is set (issue 01, record 004).
// Transaction-local, so a pooled connection carries nothing into the next
// request. `setting` is always a literal from the three helpers below.
const withScope = <T>(
  db: DatabaseInstance,
  setting: string,
  value: string | null,
  fn: (scopedDb: DatabaseInstance) => Promise<T>,
): Promise<T> =>
  db.transaction().execute(async (trx) => {
    if (value !== null) {
      await sql`select set_config(${setting}, ${value}, true)`.execute(trx);
    }
    return fn(trx);
  });

export const withTenantScope = <T>(
  db: DatabaseInstance,
  tenantId: string | null,
  fn: (scopedDb: DatabaseInstance) => Promise<T>,
): Promise<T> => withScope(db, "app.tenant_id", tenantId, fn);

// Pre-auth: no tenant exists yet. A purpose-named variable leaves
// `app.tenant_id` unset, so every tenant-keyed policy denies while these are
// open, and both call sites stay greppable. See .scratch/decisions/031.
export const withLoginScope = <T>(
  db: DatabaseInstance,
  email: string,
  fn: (scopedDb: DatabaseInstance) => Promise<T>,
): Promise<T> => withScope(db, "app.login_email", email, fn);

export const withSessionScope = <T>(
  db: DatabaseInstance,
  sessionId: string,
  fn: (scopedDb: DatabaseInstance) => Promise<T>,
): Promise<T> => withScope(db, "app.session_id", sessionId, fn);

// Pre-auth Device lookup (issue 09, record 056 Q6/031): the tenant is
// unknown until the Device is found by its token hash.
export const withDeviceTokenScope = <T>(
  db: DatabaseInstance,
  tokenHash: string,
  fn: (scopedDb: DatabaseInstance) => Promise<T>,
): Promise<T> => withScope(db, "app.device_token_hash", tokenHash, fn);

// Pre-auth EnrolmentCode lookup for `terminal.enrol` (record 056 Q6/031).
export const withEnrolmentCodeScope = <T>(
  db: DatabaseInstance,
  code: string,
  fn: (scopedDb: DatabaseInstance) => Promise<T>,
): Promise<T> => withScope(db, "app.enrolment_code", code, fn);
