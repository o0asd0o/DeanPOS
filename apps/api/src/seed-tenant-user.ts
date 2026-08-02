import { randomUUID } from "node:crypto";

import type { DatabaseInstance } from "backend/src/db/client.ts";
import type { Role } from "backend/src/db/prisma/generated/types.ts";

// The live gate (backend/src/context.ts) derives the current role from
// UserRole, never User.role (issue 04, round 1 finding 1) — every test that
// seeds a User directly through the migration owner and then signs in needs
// the opening UserRole row too, or the session it signs in resolves to
// unauthenticated.
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
