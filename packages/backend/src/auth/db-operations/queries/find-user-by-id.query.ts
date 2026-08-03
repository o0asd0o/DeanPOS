import type { DatabaseInstance } from "../../../db/client.ts";

// Explicit column list, never selectAll — this feeds session context and
// the User editor's save response; neither needs `password_hash`/`pin_hash`.
export const findUserById = (db: DatabaseInstance, id: string) =>
  db
    .selectFrom("User")
    .select([
      "id",
      "tenant_id",
      "email",
      "first_name",
      "last_name",
      "must_change_password",
      "role",
      "active",
      "createdAt",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
