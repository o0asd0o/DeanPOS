import { withTenantScope } from "../../../db/client.ts";
import type { DatabaseInstance } from "../../../db/client.ts";

// Reuses `withTenantScope`'s single choke point with the session id as the
// scope value — see the migration's "session_self_lookup" policy and this
// issue's `## Comments` (record 029's pattern, applied to a sibling case).
export const findSessionById = (db: DatabaseInstance, sessionId: string) =>
  withTenantScope(db, sessionId, (scopedDb) =>
    scopedDb.selectFrom("Session").selectAll().where("id", "=", sessionId).executeTakeFirst(),
  );
