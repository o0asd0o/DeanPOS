import type { DatabaseInstance } from "../../../db/client.ts";

// The latest effective-dated row on or before `asOf`, never the current row
// (issue 04, PRD "as of a given time") — what issue 12 re-verifies an
// offline Override against. "Exactly at T" is inclusive (round 1 finding 4).
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
