import { randomUUID } from "node:crypto";

import { sql } from "kysely";

import type { DatabaseTransaction } from "../../../db/client.ts";

export type ConsumeOverrideInput = {
  tenantId: string;
  overrideId: string;
  actionType: string;
  storeId: string;
  subjectKind: "order" | "drawerSession";
  subjectId: string;
};

// ADR-0005's fixed four actions, each against exactly one subject kind — the
// single source of truth for which column a consumption is recorded under.
const SUBJECT_KIND_BY_ACTION_TYPE: Record<string, "order" | "drawerSession"> = {
  void_paid_order: "order",
  refund: "order",
  line_price_override: "order",
  drawer_variance: "drawerSession",
};

// One INSERT, guarded only by OverrideConsumption's unique index, not
// ON CONFLICT (record 060 Q2). Zero rows is the refusal for every cause.
// `trx` must be a real transaction, committing atomically with its caller.
export const consumeOverride = async (
  trx: DatabaseTransaction,
  input: ConsumeOverrideInput,
): Promise<boolean> => {
  // Subject column is derived from the validated action type, never the
  // caller's say-so — a mismatched kind (e.g. drawer_variance vs order_id)
  // is refused here, before any query.
  const expectedKind = SUBJECT_KIND_BY_ACTION_TYPE[input.actionType];
  if (expectedKind === undefined || expectedKind !== input.subjectKind) return false;

  const id = randomUUID();
  const orderId = expectedKind === "order" ? input.subjectId : null;
  const drawerSessionId = expectedKind === "drawerSession" ? input.subjectId : null;

  const result = await sql<{ id: string }>`
    INSERT INTO "OverrideConsumption" ("id", "tenant_id", "override_id", "order_id", "drawer_session_id")
    SELECT ${id}, o."tenant_id", o."id", ${orderId}, ${drawerSessionId}
    FROM "Override" o
    WHERE o."tenant_id" = ${input.tenantId}
      AND o."id" = ${input.overrideId}
      AND o."action_type" = ${input.actionType}
      AND o."store_id" = ${input.storeId}
    ON CONFLICT ("tenant_id", "override_id") DO NOTHING
    RETURNING "id"
  `.execute(trx);

  return result.rows.length === 1;
};
