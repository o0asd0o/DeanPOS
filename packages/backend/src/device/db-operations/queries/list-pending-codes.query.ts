import type { DatabaseInstance } from "../../../db/client.ts";

// Unredeemed and unexpired only — a consumed or expired code is nothing the
// back office can still act on.
export const listPendingCodes = (db: DatabaseInstance) =>
  db
    .selectFrom("EnrolmentCode")
    .selectAll()
    .where("consumed_at", "is", null)
    .where("expires_at", ">", new Date())
    .orderBy("created_at", "asc")
    .execute();
