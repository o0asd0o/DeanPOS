import { sql } from "kysely";

import type { DatabaseInstance } from "../../../db/client.ts";

// Record 034: undoes this request's own reservation on success. A plain
// decrement, never a reset to 0 — a key with other standing failures keeps them.
export const releaseThrottleReservation = (db: DatabaseInstance, key: string) =>
  sql`UPDATE "SignInThrottle" SET "failures" = "failures" - 1 WHERE "key" = ${key}`.execute(db);
