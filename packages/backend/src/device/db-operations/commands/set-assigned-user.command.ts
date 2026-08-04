import type { DatabaseInstance } from "../../../db/client.ts";

// `userId: null` clears the restriction — issue 17's open-to-all default.
export const setAssignedUser = (db: DatabaseInstance, id: string, userId: string | null) =>
  db
    .updateTable("Device")
    .set({ assigned_user_id: userId })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
