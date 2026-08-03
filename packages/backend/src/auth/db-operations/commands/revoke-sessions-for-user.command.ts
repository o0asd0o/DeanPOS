import type { DatabaseInstance } from "../../../db/client.ts";

// Every one of a User's live sessions, not just the caller's own (record
// 043/044: deactivation and password reset are both immediate).
export const revokeSessionsForUser = (db: DatabaseInstance, userId: string) =>
  db
    .updateTable("Session")
    .set({ revoked_at: new Date() })
    .where("user_id", "=", userId)
    .where("revoked_at", "is", null)
    .execute();
