import type { DatabaseInstance } from "../../../db/client.ts";

export const touchSession = (db: DatabaseInstance, sessionId: string) =>
  db.updateTable("Session").set({ last_seen_at: new Date() }).where("id", "=", sessionId).execute();
