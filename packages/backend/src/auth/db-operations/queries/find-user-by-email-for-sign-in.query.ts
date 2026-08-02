import { withLoginScope } from "../../../db/client.ts";
import type { DatabaseInstance } from "../../../db/client.ts";

// Pre-auth one-row read, keyed on the globally-unique email. See
// .scratch/decisions/031 and the migration's "user_login_lookup" policy.
export const findUserByEmailForSignIn = (db: DatabaseInstance, email: string) =>
  withLoginScope(db, email, (scopedDb) =>
    scopedDb.selectFrom("User").selectAll().where("email", "=", email).executeTakeFirst(),
  );
