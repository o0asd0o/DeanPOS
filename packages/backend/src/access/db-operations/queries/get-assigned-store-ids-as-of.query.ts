import type { DatabaseInstance } from "../../../db/client.ts";

// One (user, store) pair can carry several rows over time; the latest row on
// or before `asOf` decides whether the assignment was open or closed then
// (issue 04's un-assign-writes-a-closing-row rule).
export const getAssignedStoreIdsAsOf = async (
  db: DatabaseInstance,
  userId: string,
  asOf: Date,
): Promise<string[]> => {
  const rows = await db
    .selectFrom("UserStore")
    .select(["store_id", "assigned"])
    .where("user_id", "=", userId)
    .where("effective_from", "<=", asOf)
    .orderBy("effective_from", "desc")
    .orderBy("created_at", "desc")
    .execute();

  const latestByStore = new Map<string, boolean>();
  for (const row of rows) {
    if (!latestByStore.has(row.store_id)) latestByStore.set(row.store_id, row.assigned);
  }

  return [...latestByStore].filter(([, assigned]) => assigned).map(([storeId]) => storeId);
};
