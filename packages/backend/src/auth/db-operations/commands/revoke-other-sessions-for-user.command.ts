import type { DatabaseInstance } from "../../../db/client.ts";

// Record 065 §3: every other live Session for this User, but not the
// caller's own — calling revokeSessionsForUser unchanged here would sign
// the User out of the screen they are standing on.
export const revokeOtherSessionsForUser = (
  db: DatabaseInstance,
  userId: string,
  exceptSessionId: string,
) =>
  db
    .updateTable("Session")
    .set({ revoked_at: new Date() })
    .where("user_id", "=", userId)
    .where("revoked_at", "is", null)
    .where("id", "!=", exceptSessionId)
    .execute();
