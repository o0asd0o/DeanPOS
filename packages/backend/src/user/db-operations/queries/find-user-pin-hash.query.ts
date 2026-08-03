import type { DatabaseInstance } from "../../../db/client.ts";

// Server-only read of the hash, to verify a `currentPin` before a change
// (issue 10) — never selected alongside the rest of the row.
export const findUserPinHash = (db: DatabaseInstance, userId: string) =>
  db.selectFrom("User").select(["id", "pin_hash"]).where("id", "=", userId).executeTakeFirst();
