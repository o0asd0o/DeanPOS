import { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { hashPassword, verifyPassword } from "../../common/password.ts";
import { withTenantScope } from "../../db/client.ts";
import { revokeOtherSessionsForUser } from "../db-operations/commands/revoke-other-sessions-for-user.command.ts";
import { updateUserPassword } from "../db-operations/commands/update-user-password.command.ts";
import { findUserPasswordHashForChange } from "../db-operations/queries/find-user-password-hash-for-change.query.ts";
import { passwordSchema, signInPasswordSchema } from "../password-policy.ts";
import {
  clearPasswordChangeThrottle,
  passwordChangeThrottleKey,
  releasePasswordChangeThrottle,
  reservePasswordChangeAttempt,
} from "../throttle.ts";

export const inputSchema = z.object({
  currentPassword: signInPasswordSchema,
  newPassword: passwordSchema,
});

type ChangePasswordInput = z.infer<typeof inputSchema>;
type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: "wrong-current-password" | "throttled" | "refused" };

// A second procedure, not a branch on auth.setPassword (record 065 §1):
// refuses when mustChangePassword is set — the exact mirror of
// setPassword's guard, keeping the two preconditions disjoint.
export const handler: Handler<ChangePasswordInput, ChangePasswordResult> = async ({
  ctx,
  input,
}) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId) return { ok: false, reason: "refused" };
  if (ctx.principal.mustChangePassword) return { ok: false, reason: "refused" };
  // A real session always carries one (context.ts:74); a principal built
  // without one cannot have its other sessions safely excluded, so it is
  // refused rather than silently revoking nothing.
  if (!ctx.principal.sessionId) return { ok: false, reason: "refused" };

  const { userId, tenantId, sessionId } = ctx.principal;
  const key = passwordChangeThrottleKey(userId);

  // Record 034's ordering: reserved before the hash, atomically — a
  // read-then-write check leaves the concurrency window 034 closes.
  if (await reservePasswordChangeAttempt(ctx.db, key)) {
    return { ok: false, reason: "throttled" };
  }

  const user = await withTenantScope(ctx.db, tenantId, (db) =>
    findUserPasswordHashForChange(db, userId),
  );
  const passwordOk = user ? await verifyPassword(input.currentPassword, user.password_hash) : false;

  if (!passwordOk) {
    // The reservation above already recorded this failure — no second write.
    return { ok: false, reason: "wrong-current-password" };
  }

  await releasePasswordChangeThrottle(ctx.db, key);
  await clearPasswordChangeThrottle(ctx.db, key);

  const passwordHash = await hashPassword(input.newPassword);
  await withTenantScope(ctx.db, tenantId, async (db) => {
    await updateUserPassword(db, userId, passwordHash);
    await revokeOtherSessionsForUser(db, userId, sessionId);
  });

  return { ok: true };
};
