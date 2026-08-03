import type { DatabaseInstance } from "../../../db/client.ts";

// The single-use guarantee (issue 09 acceptance criteria, record 056 Q4):
// zero rows affected is the refusal — the caller must check
// `numUpdatedRows`, not assume success. Must run in the same transaction as
// the Device insert so a unique-violation on the code rolls both back.
export const consumeEnrolmentCode = async (
  db: DatabaseInstance,
  id: string,
  deviceId: string,
): Promise<boolean> => {
  const result = await db
    .updateTable("EnrolmentCode")
    .set({ consumed_at: new Date(), device_id: deviceId })
    .where("id", "=", id)
    .where("consumed_at", "is", null)
    .executeTakeFirst();
  return result.numUpdatedRows > 0n;
};
