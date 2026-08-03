import type { DatabaseInstance } from "../../../db/client.ts";

export const listDevices = (db: DatabaseInstance) =>
  db.selectFrom("Device").selectAll().orderBy("enrolled_at", "asc").execute();
