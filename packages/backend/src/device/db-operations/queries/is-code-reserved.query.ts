import type { DatabaseInstance } from "../../../db/client.ts";

// Advisory only (record 056 Q4) — the hard guarantee is Device's own full
// unique index, which bites at exchange. This exists purely to produce a
// good message before generating a code nobody can ever redeem.
export const isCodeReserved = async (
  db: DatabaseInstance,
  storeId: string,
  code: string,
): Promise<boolean> => {
  const device = await db
    .selectFrom("Device")
    .select("id")
    .where("store_id", "=", storeId)
    .where("code", "=", code)
    .executeTakeFirst();
  if (device) return true;

  const pending = await db
    .selectFrom("EnrolmentCode")
    .select("id")
    .where("store_id", "=", storeId)
    .where("code", "=", code)
    .where("consumed_at", "is", null)
    .where("expires_at", ">", new Date())
    .executeTakeFirst();
  return pending !== undefined;
};
