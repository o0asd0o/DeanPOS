import type { DatabaseInstance } from "../../../db/client.ts";

// Deactivation and reactivation share this one column-only command — never
// the save procedure that moves name/hours/labels (record 040 §3).
export const setStoreActive = (db: DatabaseInstance, id: string, active: boolean) =>
  db.updateTable("Store").set({ active }).where("id", "=", id).returningAll().executeTakeFirst();
