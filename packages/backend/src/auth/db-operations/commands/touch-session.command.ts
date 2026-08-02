import type { DatabaseInstance } from "../../../db/client.ts";

// Bumps the idle-expiry clock. Called inside the same self-lookup
// transaction as find-session-by-id.query.ts (see "session_tenant_update"'s
// id-scoped branch).
export const touchSession = (db: DatabaseInstance, sessionId: string) =>
  db.updateTable("Session").set({ last_seen_at: new Date() }).where("id", "=", sessionId).execute();
