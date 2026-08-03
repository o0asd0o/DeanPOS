import { z } from "zod";

import { getAssignedStoreIdsAsOf } from "../../access/db-operations/queries/get-assigned-store-ids-as-of.query.ts";
import { revokeSessionsForUser } from "../../auth/db-operations/commands/revoke-sessions-for-user.command.ts";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setUserActive } from "../db-operations/commands/set-user-active.command.ts";
import { toUserOutput } from "../helpers.ts";

export const inputSchema = z.object({ id: z.string() });

type UserOutput = ReturnType<typeof toUserOutput>;

// `admin` only. Never hard-deletes; flips `active` and revokes sessions in
// one transaction (issue 06 criterion 5). Self-deactivation refused —
// record 044 §4 clause 2.
export const handler: Handler<{ id: string }, UserOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role, userId: callerId } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return null;
  if (callerId === input.id) return null;

  const result = await withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const user = await setUserActive(scopedDb, input.id, false);
    if (!user) return null;
    await revokeSessionsForUser(scopedDb, input.id);
    const storeIds = await getAssignedStoreIdsAsOf(scopedDb, input.id, new Date());
    return { user, storeIds };
  });

  if (!result) return null;
  return toUserOutput(result.user, result.storeIds);
};
