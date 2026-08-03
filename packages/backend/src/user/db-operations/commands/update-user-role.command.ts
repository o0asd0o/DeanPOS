import type { DatabaseInstance } from "../../../db/client.ts";
import type { Role } from "../../../db/prisma/generated/types.ts";

// The denormalised convenience column. Written in the same transaction as
// the matching `UserRole` history row and never on its own (record 045 §4
// clause 3) — the two must never disagree.
export const updateUserRole = (db: DatabaseInstance, userId: string, role: Role) =>
  db.updateTable("User").set({ role }).where("id", "=", userId).returningAll().executeTakeFirst();
