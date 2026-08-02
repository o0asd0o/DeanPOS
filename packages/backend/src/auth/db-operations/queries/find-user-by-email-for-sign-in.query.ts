import { withTenantScope } from "../../../db/client.ts";
import type { DatabaseInstance } from "../../../db/client.ts";

// Reuses `withTenantScope`'s single choke point with the email as the scope
// value — see the migration's "user_login_lookup" policy and this issue's
// `## Comments` (record 029's pattern, applied to a sibling case).
export const findUserByEmailForSignIn = (db: DatabaseInstance, email: string) =>
  withTenantScope(db, email, (scopedDb) =>
    scopedDb.selectFrom("User").selectAll().where("email", "=", email).executeTakeFirst(),
  );
