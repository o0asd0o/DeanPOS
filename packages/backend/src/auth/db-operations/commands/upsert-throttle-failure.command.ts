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
  const result = await db
    .insertInto("SignInThrottle")
    .values({ key, failures: 1, updated_at: sql<Date>`now()` })
    .onConflict((oc) =>
      oc.column("key").doUpdateSet(({ eb, ref }) => ({
        failures: eb
          .case()
          .when("SignInThrottle.updated_at", "<", staleBefore)
          .then(1)
          .else(eb(ref("SignInThrottle.failures"), "+", 1))
          .end(),
        updated_at: sql<Date>`now()`,
      })),
    )
    .returning("failures")
    .executeTakeFirstOrThrow();

  return result.failures;
};
