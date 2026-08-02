import type { DatabaseInstance } from "../../../db/client.ts";

export const insertSession = (
  db: DatabaseInstance,
  values: { id: string; userId: string; tenantId: string; expiresAt: Date },
) =>
  db
    .insertInto("Session")
    .values({
      id: values.id,
      user_id: values.userId,
      tenant_id: values.tenantId,
      expires_at: values.expiresAt,
    })
    .execute();
