import { randomUUID } from "node:crypto";

import { sql } from "kysely";

import type { DatabaseInstance } from "../../../db/client.ts";

export type ConsumeOverrideInput = {
  tenantId: string;
  overrideId: string;
  actionType: string;
  storeId: string;
  subjectKind: "order" | "drawerSession";
  subjectId: string;
};

// Consumption is one INSERT, guarded only by OverrideConsumption's unique
// index (tenant_id, override_id) — that index is the control, not
// ON CONFLICT, which Postgres documents atomicity for only on DO UPDATE
// (record 060 Q2). Zero rows is the refusal, for every cause — unknown
// Override, wrong action type, wrong Store, already consumed — with no
// reason code. Takes a transaction: it must commit atomically with the
// action it authorises, never as a separate request.
export const consumeOverride = async (
  trx: DatabaseInstance,
  input: ConsumeOverrideInput,
): Promise<boolean> => {
  const id = randomUUID();
  const orderId = input.subjectKind === "order" ? input.subjectId : null;
  const drawerSessionId = input.subjectKind === "drawerSession" ? input.subjectId : null;

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
