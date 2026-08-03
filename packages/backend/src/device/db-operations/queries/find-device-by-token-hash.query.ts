import { withDeviceTokenScope } from "../../../db/client.ts";
import type { DatabaseInstance } from "../../../db/client.ts";

// Pre-auth one-row read, keyed on the token hash. See .scratch/decisions/031
// and the migration's "device_token_lookup" policy — one statement only.
export const findDeviceByTokenHash = (db: DatabaseInstance, tokenHash: string) =>
  withDeviceTokenScope(db, tokenHash, (scopedDb) =>
    scopedDb
      .selectFrom("Device")
      .selectAll()
      .where("token_hash", "=", tokenHash)
      .executeTakeFirst(),
  );
