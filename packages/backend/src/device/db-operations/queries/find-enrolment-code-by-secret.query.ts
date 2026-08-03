import { withEnrolmentCodeScope } from "../../../db/client.ts";
import type { DatabaseInstance } from "../../../db/client.ts";

// Pre-auth one-row read for `terminal.enrol`, keyed on the secret. Record
// 031/056 — one statement, no tenant known yet.
export const findEnrolmentCodeBySecret = (db: DatabaseInstance, secret: string) =>
  withEnrolmentCodeScope(db, secret, (scopedDb) =>
    scopedDb
      .selectFrom("EnrolmentCode")
      .selectAll()
      .where("secret", "=", secret)
      .executeTakeFirst(),
  );
