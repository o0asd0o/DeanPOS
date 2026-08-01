import { sql } from "kysely";

import type { DatabaseInstance } from "../../../db/client.ts";

export const checkDatabase = async (db: DatabaseInstance): Promise<boolean> => {
  try {
    await sql`select 1`.execute(db);
    return true;
  } catch {
    return false;
  }
};
