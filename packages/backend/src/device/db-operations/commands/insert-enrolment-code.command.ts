import type { DatabaseInstance } from "../../../db/client.ts";

export const insertEnrolmentCode = (
  db: DatabaseInstance,
  values: {
    id: string;
    tenantId: string;
    storeId: string;
    name: string;
    code: string;
    secret: string;
    expiresAt: Date;
  },
) =>
  db
    .insertInto("EnrolmentCode")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      store_id: values.storeId,
      name: values.name,
      code: values.code,
      secret: values.secret,
      expires_at: values.expiresAt,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
