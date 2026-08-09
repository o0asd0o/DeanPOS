import { sql } from "../../../db/client.ts";
import type { DatabaseInstance } from "../../../db/client.ts";

// App role deliberately has no UPDATE on Discount. Advisory locks serialize
// versioned writes without weakening the append-only grant.
export const lockDiscount = (db: DatabaseInstance, key: string) =>
  // Keep raw: PostgreSQL advisory locks have no Kysely builder equivalent.
  sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`.execute(db);
