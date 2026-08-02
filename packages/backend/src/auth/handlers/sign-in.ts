import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getRoleAsOf } from "../../access/db-operations/queries/get-role-as-of.query.ts";
import type { Handler } from "../../common/handler.ts";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "../../common/password.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertSession } from "../db-operations/commands/insert-session.command.ts";
import { findUserByEmailForSignIn } from "../db-operations/queries/find-user-by-email-for-sign-in.query.ts";
import { signInPasswordSchema } from "../password-policy.ts";
import { SESSION_ABSOLUTE_TTL_MS } from "../session-policy.ts";
import {
  clearSignInThrottle,
  releaseSignInThrottle,
  reserveSignInAttempt,
  throttleKeys,
} from "../throttle.ts";

export const inputSchema = z.object({
  email: z.string().email(),
  password: signInPasswordSchema,
});

type SignInInput = z.infer<typeof inputSchema>;
type SignInResult =
  | { ok: true; mustChangePassword: boolean; sessionId: string; expiresAt: Date }
  | { ok: false };

// Shape and message are identical for every failure cause (issue 03
// criterion 5; record 030). A throttled request returns early, faster by
// one scrypt derivation — record 033 accepts that: it reveals lock state, not account existence.
export const handler: Handler<SignInInput, SignInResult> = async ({ ctx, input }) => {
  const keys = throttleKeys(input.email, ctx.clientIp);

  // Reserved before the hash, atomically (record 034): scryptSync blocks
  // the whole API for one derivation, and a read-then-write check leaves a
  // window where concurrent requests all pass it before any of them writes.
  if (await reserveSignInAttempt(ctx.db, keys)) return { ok: false };

  const user = await findUserByEmailForSignIn(ctx.db, input.email);
  const passwordOk = await verifyPassword(
    input.password,
    user?.password_hash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !user.active || !passwordOk) {
    // The reservation above already recorded this failure — no second write.
    return { ok: false };
  }

  // A roleless User fails the live gate anyway (issue 04 round 2 finding 1);
  // refused here, before the throttle releases, same shape as wrong password.
  const currentRole = await withTenantScope(ctx.db, user.tenant_id, (db) =>
    getRoleAsOf(db, user.id, new Date()),
  );
  if (!currentRole) return { ok: false };

  await releaseSignInThrottle(ctx.db, keys);
  await clearSignInThrottle(ctx.db, keys);

  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_ABSOLUTE_TTL_MS);

  await withTenantScope(ctx.db, user.tenant_id, (db) =>
    insertSession(db, { id: sessionId, userId: user.id, tenantId: user.tenant_id, expiresAt }),
  );

  return { ok: true, mustChangePassword: user.must_change_password, sessionId, expiresAt };
};
