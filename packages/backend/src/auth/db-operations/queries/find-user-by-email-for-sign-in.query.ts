import { withLoginScope } from "../../../db/client.ts";
import type { DatabaseInstance } from "../../../db/client.ts";

// Pre-auth one-row read, keyed on the globally-unique email. See
// .scratch/decisions/031 and the migration's "user_login_lookup" policy.
// Explicit column list, never selectAll — sign-in needs `password_hash`,
// never `pin_hash` (issue 10).
export const findUserByEmailForSignIn = (db: DatabaseInstance, email: string) =>
  withLoginScope(db, email, (scopedDb) =>
    scopedDb
      .selectFrom("User")
      .select(["id", "tenant_id", "password_hash", "active", "must_change_password"])
      .where("email", "=", email)
      .executeTakeFirst(),
  );
