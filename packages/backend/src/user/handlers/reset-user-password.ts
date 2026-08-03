import { z } from "zod";

import { getAssignedStoreIdsAsOf } from "../../access/db-operations/queries/get-assigned-store-ids-as-of.query.ts";
import { passwordSchema } from "../../auth/password-policy.ts";
import { revokeSessionsForUser } from "../../auth/db-operations/commands/revoke-sessions-for-user.command.ts";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { hashPassword } from "../../common/password.ts";
import { withTenantScope } from "../../db/client.ts";
import { resetUserPassword } from "../db-operations/commands/reset-user-password.command.ts";
import { toUserOutput } from "../helpers.ts";

export const inputSchema = z.object({ id: z.string(), password: passwordSchema });

type ResetUserPasswordInput = z.infer<typeof inputSchema>;
type UserOutput = ReturnType<typeof toUserOutput>;

// `admin` only. Its own procedure, never the editor's save (record 043's
// "reset" section, record 040's rule): a new hash, `mustChangePassword` back
// to `true`, and every one of the User's sessions revoked — all in the same
// transaction, so a live session cannot outlive the reset meant to recover
// from it.
export const handler: Handler<ResetUserPasswordInput, UserOutput | null> = async ({
  ctx,
  input,
}) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return null;

  const passwordHash = await hashPassword(input.password);

  const result = await withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const user = await resetUserPassword(scopedDb, input.id, passwordHash);
    if (!user) return null;
    await revokeSessionsForUser(scopedDb, input.id);
    const storeIds = await getAssignedStoreIdsAsOf(scopedDb, input.id, new Date());
    return { user, storeIds };
  });

  if (!result) return null;
  return toUserOutput(result.user, result.storeIds);
};
