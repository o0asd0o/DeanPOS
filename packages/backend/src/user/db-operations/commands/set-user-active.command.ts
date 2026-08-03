import type { DatabaseInstance } from "../../../db/client.ts";

// Never hard-deletes — flips `active` (record 044 §4). Deactivation revokes
// the User's sessions separately, in the same transaction as this call.
export const setUserActive = (db: DatabaseInstance, userId: string, active: boolean) =>
  db.updateTable("User").set({ active }).where("id", "=", userId).returningAll().executeTakeFirst();
