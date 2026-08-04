import type { DatabaseInstance } from "../../../db/client.ts";

// Explicit column list, never selectAll — auth.changePassword's own
// re-verification read, scoped by the caller's tenant and own userId.
export const findUserPasswordHashForChange = (db: DatabaseInstance, userId: string) =>
  db.selectFrom("User").select(["id", "password_hash"]).where("id", "=", userId).executeTakeFirst();
