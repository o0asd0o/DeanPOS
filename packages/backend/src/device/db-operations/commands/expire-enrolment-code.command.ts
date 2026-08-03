import type { DatabaseInstance } from "../../../db/client.ts";

// Cancelling expires the code rather than deleting it: its `code_generated`
// audit row points here, and `enrol` already refuses anything expired. The
// short code frees up again at that Store, which is the point of cancelling.
export const expireEnrolmentCode = async (db: DatabaseInstance, id: string): Promise<boolean> => {
  const result = await db
    .updateTable("EnrolmentCode")
    .set({ expires_at: new Date() })
    .where("id", "=", id)
    .where("consumed_at", "is", null)
    .executeTakeFirst();
  return result.numUpdatedRows > 0n;
};
