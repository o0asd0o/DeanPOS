import type { DatabaseInstance } from "../../../db/client.ts";

// Clears the hash to NULL rather than minting a temporary PIN — the User
// sets their own on next use (issue 10, record 057 "smaller calls" 4).
export const resetUserPin = (db: DatabaseInstance, userId: string) =>
  db
    .updateTable("User")
    .set({ pin_hash: null })
    .where("id", "=", userId)
    .returning(["id"])
    .executeTakeFirst();
