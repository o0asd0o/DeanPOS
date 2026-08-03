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

// `admin` only, its own procedure, never the editor's save (record 043
// "reset", record 040). New hash, `mustChangePassword` true, sessions
// revoked — one transaction.
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
