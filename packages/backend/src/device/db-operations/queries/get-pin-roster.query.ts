import { getAssignedStoreIdsAsOf } from "../../../access/db-operations/queries/get-assigned-store-ids-as-of.query.ts";
import { getRoleAsOf } from "../../../access/db-operations/queries/get-role-as-of.query.ts";
import { hasAtLeastRole } from "../../../common/authorize.ts";
import type { DatabaseInstance } from "../../../db/client.ts";

export type PinRosterRow = {
  userId: string;
  displayName: string;
  pinHash: string | null;
  canApproveOverride: boolean;
};

// The hash-sync roster (issue 10, record 057 Q3): every active User who is
// `admin`, or currently assigned to `storeId` — resolved through the same
// two effective-dated resolvers issue 04 already wrote, never User.role.
export const getPinRoster = async (
  db: DatabaseInstance,
  storeId: string,
  assignedUserId: string | null,
): Promise<PinRosterRow[]> => {
  const users = await db
    .selectFrom("User")
    .select(["id", "first_name", "last_name", "pin_hash"])
    .where("active", "=", true)
    .execute();

  const now = new Date();
  const roster: PinRosterRow[] = [];

  for (const user of users) {
    const currentRole = await getRoleAsOf(db, user.id, now);
    let qualifies = currentRole?.role === "admin";
    if (!qualifies) {
      const storeIds = await getAssignedStoreIdsAsOf(db, user.id, now);
      qualifies = storeIds.includes(storeId);
    }
    if (!qualifies) continue;

    roster.push({
      userId: user.id,

      // A provisioned tenant owner and every pre-name row carry '' for both
      // names (20260803120000_employee_names) — a blank button is unusable,
      // and the payload deliberately never carries the email to fall back on.
      displayName: `${user.first_name} ${user.last_name}`.trim() || "Unknown",
      pinHash: user.pin_hash,
      canApproveOverride: currentRole !== undefined && hasAtLeastRole(currentRole.role, "manager"),
    });
  }

  if (assignedUserId === null) return roster;
  return roster.filter((user) => user.userId === assignedUserId || user.canApproveOverride);
};
