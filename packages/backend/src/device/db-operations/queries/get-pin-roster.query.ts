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
      displayName: `${user.first_name} ${user.last_name}`.trim(),
      pinHash: user.pin_hash,
      canApproveOverride: currentRole !== undefined && hasAtLeastRole(currentRole.role, "manager"),
    });
  }

  return roster;
};
