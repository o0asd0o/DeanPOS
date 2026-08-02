import type { DatabaseInstance } from "../../../db/client.ts";

export const clearThrottleKey = (db: DatabaseInstance, key: string) =>
  db.deleteFrom("SignInThrottle").where("key", "=", key).execute();
