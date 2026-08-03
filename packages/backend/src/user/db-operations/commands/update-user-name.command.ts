import type { DatabaseInstance } from "../../../db/client.ts";

// A name is plain profile data: no history table, no effective dating. It
// travels in the same transaction as the role and assignment edits so one
// save is one write (record 053).
export const updateUserName = (
  db: DatabaseInstance,
  userId: string,
  values: { firstName: string; lastName: string },
) =>
  db
    .updateTable("User")
    .set({ first_name: values.firstName, last_name: values.lastName })
    .where("id", "=", userId)
    .executeTakeFirst();
