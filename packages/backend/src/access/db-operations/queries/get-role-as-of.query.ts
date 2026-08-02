import type { DatabaseInstance } from "../../../db/client.ts";

// The truth an offline Override re-verifies against (issue 12): the latest
// effective-dated row on or before `asOf`, never the current row regardless
// of when the caller asks (issue 04, PRD "as of a given time").
export const getRoleAsOf = (db: DatabaseInstance, userId: string, asOf: Date) =>
  db
    .selectFrom("UserRole")
    .select(["role"])
    .where("user_id", "=", userId)
    .where("effective_from", "<=", asOf)
    .orderBy("effective_from", "desc")
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst();
