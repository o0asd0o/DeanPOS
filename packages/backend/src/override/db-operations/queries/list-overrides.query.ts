import type { DatabaseInstance } from "../../../db/client.ts";

export type OverrideListRow = {
  id: string;
  approved_at: Date;
  store_id: string;
  store_name: string;
  action_type: string;
  approver_first_name: string;
  approver_last_name: string;
  reason: string;
  note: string | null;
  device_id: string;
  device_name: string;
};

// `storeIds === null` is unrestricted (admin, criterion 8) — otherwise the
// caller's own assigned Stores, today's, not an as-of claim (criterion 8's
// "now, not as-of"). An empty array must read as zero rows, never as
// unrestricted — `where … in ([])` is handled explicitly rather than trusted
// to Kysely/Postgres.
export const listOverrides = (
  db: DatabaseInstance,
  storeIds: string[] | null,
): Promise<OverrideListRow[]> => {
  if (storeIds !== null && storeIds.length === 0) return Promise.resolve([]);

  let query = db
    .selectFrom("Override as o")
    .innerJoin("Store as s", (join) =>
      join.onRef("s.tenant_id", "=", "o.tenant_id").onRef("s.id", "=", "o.store_id"),
    )
    .innerJoin("User as u", (join) =>
      join.onRef("u.tenant_id", "=", "o.tenant_id").onRef("u.id", "=", "o.approver_user_id"),
    )
    .innerJoin("Device as d", (join) =>
      join.onRef("d.tenant_id", "=", "o.tenant_id").onRef("d.id", "=", "o.device_id"),
    )
    .select([
      "o.id as id",
      "o.approved_at as approved_at",
      "o.store_id as store_id",
      "s.name as store_name",
      "o.action_type as action_type",
      "u.first_name as approver_first_name",
      "u.last_name as approver_last_name",
      "o.reason as reason",
      "o.note as note",
      "o.device_id as device_id",
      "d.name as device_name",
    ])
    .orderBy("o.approved_at", "desc");

  if (storeIds !== null) query = query.where("o.store_id", "in", storeIds);

  return query.execute();
};
