import type { DatabaseInstance } from "../../../db/client.ts";

// Called from buildContextFromDeviceToken on every request (issue 09).
// Conditioned on revoked_at IS NULL: zero rows back means a revoke won
// the race, and the caller must refuse.
export const touchDevice = (db: DatabaseInstance, id: string) =>
  db
    .updateTable("Device")
    .set({ last_seen_at: new Date() })
    .where("id", "=", id)
    .where("revoked_at", "is", null)
    .returningAll()
    .executeTakeFirst();
