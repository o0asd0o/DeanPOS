import type { DatabaseInstance } from "../../../db/client.ts";

export const setUserPin = (db: DatabaseInstance, userId: string, pinHash: string) =>
  db
    .updateTable("User")
    .set({ pin_hash: pinHash })
    .where("id", "=", userId)
    .returning(["id"])
    .executeTakeFirst();
