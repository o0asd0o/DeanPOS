import type { DatabaseInstance } from "../../../db/client.ts";

export const insertTenant = (db: DatabaseInstance, values: { id: string; name: string }) =>
  db.insertInto("Tenant").values(values).execute();
