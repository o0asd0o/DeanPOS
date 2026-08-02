import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "../../common/password.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertSession } from "../db-operations/commands/insert-session.command.ts";
import { findUserByEmailForSignIn } from "../db-operations/queries/find-user-by-email-for-sign-in.query.ts";
import { signInPasswordSchema } from "../password-policy.ts";
import { SESSION_ABSOLUTE_TTL_MS } from "../session-policy.ts";
import {
  clearSignInThrottle,
  isThrottled,
  recordSignInFailure,
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

// One failure shape for every cause, never distinguished in message or
// timing (issue 03 acceptance criterion 5; record 030): `verifyPassword`
// always runs once, against the real hash or a fixed dummy one.
export const handler: Handler<SignInInput, SignInResult> = async ({ ctx, input }) => {
  const keys = throttleKeys(input.email, ctx.clientIp);

  // Checked before the hash, mandatorily (record 033): scryptSync blocks
  // the whole API for one derivation, so an unthrottled loop is a full
  // outage. This touches only the throttle table, never `User`.
  if (await isThrottled(ctx.db, keys)) return { ok: false };

  const user = await findUserByEmailForSignIn(ctx.db, input.email);
  const passwordOk = await verifyPassword(
    input.password,
    user?.password_hash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !user.active || !passwordOk) {
    // Incremented whether or not `user` was found — see throttle.ts.
    await recordSignInFailure(ctx.db, keys);
    return { ok: false };
  }

  await clearSignInThrottle(ctx.db, keys);

  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_ABSOLUTE_TTL_MS);

  await withTenantScope(ctx.db, user.tenant_id, (db) =>
    insertSession(db, { id: sessionId, userId: user.id, tenantId: user.tenant_id, expiresAt }),
  );

  return { ok: true, mustChangePassword: user.must_change_password, sessionId, expiresAt };
};
