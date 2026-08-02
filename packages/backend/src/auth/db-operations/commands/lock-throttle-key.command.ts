import type { DatabaseInstance } from "../../../db/client.ts";

// Reaching the limit locks the key and resets `failures` to 0, so the lock
// lifts to a fresh budget rather than escalating (record 033 step 4).
export const lockThrottleKey = (db: DatabaseInstance, key: string, lockedUntil: Date) =>
  db
    .updateTable("SignInThrottle")
    .set({ locked_until: lockedUntil, failures: 0 })
    .where("key", "=", key)
    .execute();
