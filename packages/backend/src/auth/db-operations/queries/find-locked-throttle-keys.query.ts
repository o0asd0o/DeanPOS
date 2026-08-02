import { sql } from "kysely";

import type { DatabaseInstance } from "../../../db/client.ts";

// No withLoginScope, no withTenantScope: SignInThrottle carries no
// tenant_id and this lookup must cost the same whether or not the email
// exists (record 033).
export const findLockedThrottleKeys = (db: DatabaseInstance, keys: string[]) =>
  db
    .selectFrom("SignInThrottle")
    .select("key")
    .where("key", "in", keys)
    .where(sql<boolean>`"locked_until" > now()`)
    .execute();
