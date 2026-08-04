import type { DatabaseInstance } from "../../../db/client.ts";

// Called only when a restricted Device's assigned User is absent from the
// filtered roster (issue 17 criterion "the screen says which of those it
// is") — `getPinRoster` already excludes an inactive or unassigned User, so
// this tells the two apart for the unlock screen's message. Deactivation is
// the only distinguishable cause left to check; anything else that could
// have excluded them (unassigned from the Store) reports as "unassigned".
export const getAssignedUserStatus = async (
  db: DatabaseInstance,
  userId: string,
): Promise<"deactivated" | "unassigned"> => {
  const user = await db
    .selectFrom("User")
    .select(["active"])
    .where("id", "=", userId)
    .executeTakeFirst();
  return !user || !user.active ? "deactivated" : "unassigned";
};
