import type { DatabaseInstance } from "../../../db/client.ts";

// `SELECT … FOR UPDATE` serialises the read-then-write so a rename's
// audit `oldValue` is never stale (record 034's precedent).
export const getDeviceForUpdate = (db: DatabaseInstance, id: string) =>
  db.selectFrom("Device").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
