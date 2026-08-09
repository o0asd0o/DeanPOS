import type { DatabaseInstance } from "../../../db/client.ts";

// Record 034: undoes this request's own reservation on success. A plain
// decrement, never a reset to 0 — a key with other standing failures keeps them.
export const releaseThrottleReservation = (db: DatabaseInstance, key: string) =>
  db
    .updateTable("SignInThrottle")
    .set(({ eb, ref }) => ({ failures: eb(ref("failures"), "-", 1) }))
    .where("key", "=", key)
    .execute();
