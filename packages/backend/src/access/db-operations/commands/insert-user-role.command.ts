import type { DatabaseInstance } from "../../../db/client.ts";
import type { Role } from "../../../db/prisma/generated/types.ts";

// The opening row of a User's role history. A User row must never exist
// without one — `provisionTenant` writes both in the same transaction
// (issue 04, round 1 finding 1).
export const insertUserRole = (
  db: DatabaseInstance,
  values: { id: string; tenantId: string; userId: string; role: Role; effectiveFrom: Date },
) =>
  db
    .insertInto("UserRole")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      user_id: values.userId,
      role: values.role,
      effective_from: values.effectiveFrom,
    })
    .execute();
