import type { DatabaseInstance } from "../../../db/client.ts";

// Called only when the assigned User is absent from `getPinRoster`'s
// filtered result — deactivation is the one distinguishable cause; anything
// else reports as "unassigned".
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
