import type { DatabaseInstance } from "../../../db/client.ts";

// An admin-initiated reset (record 043): unlike the user's own
// `/set-password` path, `mustChangePassword` goes back to `true` — the CSP
// now knows the secret, so it is treated as evidence of compromise.
export const resetUserPassword = (db: DatabaseInstance, userId: string, passwordHash: string) =>
  db
    .updateTable("User")
    .set({ password_hash: passwordHash, must_change_password: true })
    .where("id", "=", userId)
    .returningAll()
    .executeTakeFirst();
