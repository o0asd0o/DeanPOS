import type { DatabaseInstance } from "../../../db/client.ts";

export const revokeSession = (db: DatabaseInstance, sessionId: string) =>
  db.updateTable("Session").set({ revoked_at: new Date() }).where("id", "=", sessionId).execute();
