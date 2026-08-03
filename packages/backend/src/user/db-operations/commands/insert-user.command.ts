import type { Role } from "../../../db/prisma/generated/types.ts";
import type { DatabaseInstance } from "../../../db/client.ts";

// The opening row of a User. Every caller (provisionTenant, user.create) also
// writes the matching opening UserRole row in the same transaction — a User
// must never exist without one (issue 04, round 1 finding 1).
export const insertUser = (
  db: DatabaseInstance,
  values: {
    id: string;
    tenantId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    passwordHash: string;
    role: Role;
  },
) =>
  db
    .insertInto("User")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      email: values.email,
      first_name: values.firstName ?? "",
      last_name: values.lastName ?? "",
      password_hash: values.passwordHash,
      role: values.role,
      must_change_password: true,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
