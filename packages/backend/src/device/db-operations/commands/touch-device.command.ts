import type { DatabaseInstance } from "../../../db/client.ts";

// Every Device-token request touches this (issue 09 acceptance criteria:
// "last-seen updates on activity") — called from buildContextFromDeviceToken.
export const touchDevice = (db: DatabaseInstance, id: string) =>
  db.updateTable("Device").set({ last_seen_at: new Date() }).where("id", "=", id).execute();
