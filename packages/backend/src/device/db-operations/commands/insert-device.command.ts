import type { DatabaseInstance } from "../../../db/client.ts";

export const insertDevice = (
  db: DatabaseInstance,
  values: {
    id: string;
    tenantId: string;
    storeId: string;
    name: string;
    code: string;
    tokenHash: string;
  },
) =>
  db
    .insertInto("Device")
    .values({
      id: values.id,
      tenant_id: values.tenantId,
      store_id: values.storeId,
      name: values.name,
      code: values.code,
      token_hash: values.tokenHash,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
