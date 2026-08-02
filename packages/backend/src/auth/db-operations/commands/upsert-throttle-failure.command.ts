import { sql } from "kysely";

import type { DatabaseInstance } from "../../../db/client.ts";

// One upsert per key (record 033 step 4): a row whose `updated_at` is
// older than the throttle window resets to 1 rather than accumulating
// forever, so a once-a-month mistyper is never locked out.
export const upsertThrottleFailure = async (
  db: DatabaseInstance,
  key: string,
  staleBefore: Date,
): Promise<number> => {
  const result = await sql<{ failures: number }>`
    INSERT INTO "SignInThrottle" ("key", "failures", "updated_at")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "failures" = CASE
        WHEN "SignInThrottle"."updated_at" < ${staleBefore}
        THEN 1
        ELSE "SignInThrottle"."failures" + 1
      END,
      "updated_at" = now()
    RETURNING "failures"
  `.execute(db);

  return result.rows[0]!.failures;
};
