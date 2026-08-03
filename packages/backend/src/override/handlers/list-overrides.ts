import { z } from "zod";

import { getAssignedStoreIdsAsOf } from "../../access/db-operations/queries/get-assigned-store-ids-as-of.query.ts";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { listOverrides } from "../db-operations/queries/list-overrides.query.ts";
import { toOverrideOutput } from "../output.ts";

export const inputSchema = z.void();

type OverrideOutput = ReturnType<typeof toOverrideOutput>;

// Criterion 8, enforced here: `admin` sees the whole tenant, `manager` only
// today's assigned Stores (current, not as-of), `cashier` gets `null`, the
// shipped refusal shape (revoke-device.ts).
export const handler: Handler<void, OverrideOutput[] | null> = async ({ ctx }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId || !ctx.principal.role) return null;
  const { tenantId, userId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;

  return withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const storeIds =
      role === "admin" ? null : await getAssignedStoreIdsAsOf(scopedDb, userId, new Date());
    const rows = await listOverrides(scopedDb, storeIds);
    return rows.map(toOverrideOutput);
  });
};
