import { randomUUID } from "node:crypto";

import type { DatabaseInstance } from "backend/src/db/client.ts";
import type { Role } from "backend/src/db/prisma/generated/types.ts";

// The live gate derives the current role from UserRole, never User.role
// (backend/src/context.ts, issue 04) — a seeded User needs the opening
// UserRole row too, or the session it signs in resolves to unauthenticated.
export const seedTenantUser = async (
  ownerDb: DatabaseInstance,
  values: {
    id: string;
    tenantId: string;
    email: string;
    passwordHash: string;
    role: Role;
    active?: boolean;
    mustChangePassword?: boolean;
    firstName?: string;
    lastName?: string;
  },
) => {
  await ownerDb
    .insertInto("User")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      email: values.email,
      password_hash: values.passwordHash,
      role: values.role,
      active: values.active ?? true,
      must_change_password: values.mustChangePassword ?? true,
      ...(values.firstName !== undefined ? { first_name: values.firstName } : {}),
      ...(values.lastName !== undefined ? { last_name: values.lastName } : {}),
    })
    .execute();
  await ownerDb
    .insertInto("UserRole")
    .values({
      id: randomUUID(),
      tenant_id: values.tenantId,
      user_id: values.id,
      role: values.role,
      effective_from: new Date(),
    })
    .execute();
};
