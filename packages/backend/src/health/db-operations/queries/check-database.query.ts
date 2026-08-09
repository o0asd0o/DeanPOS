import { sql } from "kysely";

import type { DatabaseInstance } from "../../../db/client.ts";

export const checkDatabase = async (db: DatabaseInstance): Promise<boolean> => {
  try {
    // Keep raw: SELECT 1 has no source table for Kysely's selectFrom builder.
    await sql`select 1`.execute(db);
    return true;
  } catch {
    return false;
  }
};
