import type { DatabaseInstance } from "../../../db/client.ts";

export const updateUserPassword = (db: DatabaseInstance, userId: string, passwordHash: string) =>
  db
    .updateTable("User")
    .set({ password_hash: passwordHash, must_change_password: false })
    .where("id", "=", userId)
    .execute();
