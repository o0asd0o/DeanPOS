import type { Role } from "../../../db/prisma/generated/types.ts";
import type { DatabaseInstance } from "../../../db/client.ts";

export const insertUser = (
  db: DatabaseInstance,
  values: { id: string; tenantId: string; email: string; passwordHash: string; role: Role },
) =>
  db
    .insertInto("User")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      email: values.email,
      password_hash: values.passwordHash,
      role: values.role,
      must_change_password: true,
    })
    .execute();
