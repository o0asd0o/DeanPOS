import { getAssignedStoreIdsAsOf } from "../access/db-operations/queries/get-assigned-store-ids-as-of.query.ts";
import { getRoleAsOf } from "../access/db-operations/queries/get-role-as-of.query.ts";
import { hasAtLeastRole } from "../common/authorize.ts";
import type { DatabaseInstance } from "../db/client.ts";

// A tablet five minutes fast must not cash in a promotion that hasn't
// happened; the smallest allowance that survives an NTP-less Android tablet
// (record 060 Q4). Mirrored by the DB CHECK on Override.approved_at.
export const OVERRIDE_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type VerifyOverrideAsOfResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "unknown-user"
        | "no-role-history"
        | "role-too-low"
        | "not-assigned-to-store"
        | "time-out-of-bounds";
    };

// Server re-verification (record 060 Q4) for terminal.recordOverride and
// offline-sync's replay. Callers bound `asOf`'s lower edge against
// Device.enrolledAt; this bounds the upper edge against the server's clock.
export const verifyOverrideAsOf = async (
  db: DatabaseInstance,
  { userId, storeId, asOf }: { tenantId: string; userId: string; storeId: string; asOf: Date },
): Promise<VerifyOverrideAsOfResult> => {
  const now = new Date();
  if (asOf.getTime() > now.getTime() + OVERRIDE_CLOCK_SKEW_MS) {
    return { ok: false, reason: "time-out-of-bounds" };
  }

  const user = await db
    .selectFrom("User")
    .select(["id"])
    .where("id", "=", userId)
    .executeTakeFirst();
  if (!user) return { ok: false, reason: "unknown-user" };

  // History read at min(asOf, now) — a future-stamped claim buys nothing,
  // since a role/membership resolver at a future time returns today's row.
  const historyAt = asOf.getTime() < now.getTime() ? asOf : now;

  const role = await getRoleAsOf(db, userId, historyAt);
  if (!role) return { ok: false, reason: "no-role-history" };
  if (!hasAtLeastRole(role.role, "manager")) return { ok: false, reason: "role-too-low" };
  if (role.role === "admin") return { ok: true };

  const storeIds = await getAssignedStoreIdsAsOf(db, userId, historyAt);
  if (!storeIds.includes(storeId)) return { ok: false, reason: "not-assigned-to-store" };
  return { ok: true };
};

// The Device-enrolment lower bound (record 060 Q4): an Override cannot
// predate the enrolment of the terminal that produced it.
export const isAfterDeviceEnrolment = (asOf: Date, deviceEnrolledAt: Date): boolean =>
  asOf.getTime() >= deviceEnrolledAt.getTime();
