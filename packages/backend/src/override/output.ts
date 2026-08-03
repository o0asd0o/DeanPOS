import type { OverrideListRow } from "./db-operations/queries/list-overrides.query.ts";

// ADR-0005's fixed four — the DB CHECK is the authority; this narrows the
// column's plain `string` back to the contract's literal union.
type OverrideActionType = "void_paid_order" | "refund" | "line_price_override" | "drawer_variance";

// Mirrors overrideOutputSchema in packages/contract/src/contract.ts.
export const toOverrideOutput = (row: OverrideListRow) => ({
  id: row.id,
  approvedAt: row.approved_at,
  storeId: row.store_id,
  storeName: row.store_name,
  actionType: row.action_type as OverrideActionType,
  approverName: `${row.approver_first_name} ${row.approver_last_name}`.trim(),
  reason: row.reason,
  note: row.note,
  deviceId: row.device_id,
  deviceName: row.device_name,
});
