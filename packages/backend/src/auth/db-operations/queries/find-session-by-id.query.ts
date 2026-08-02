import { withSessionScope } from "../../../db/client.ts";
import type { DatabaseInstance } from "../../../db/client.ts";

// Pre-auth one-row read, keyed on the session id. See
// .scratch/decisions/031 and the migration's "session_self_lookup" policy.
export const findSessionById = (db: DatabaseInstance, sessionId: string) =>
  withSessionScope(db, sessionId, (scopedDb) =>
    scopedDb.selectFrom("Session").selectAll().where("id", "=", sessionId).executeTakeFirst(),
  );
