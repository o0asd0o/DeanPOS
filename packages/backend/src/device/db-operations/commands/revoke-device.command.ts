import type { DatabaseInstance } from "../../../db/client.ts";

export const revokeDevice = (db: DatabaseInstance, id: string, revokedAt: Date) =>
  db
    .updateTable("Device")
    .set({ revoked_at: revokedAt })
    .where("id", "=", id)
    .where("revoked_at", "is", null)
    .returningAll()
    .executeTakeFirst();
