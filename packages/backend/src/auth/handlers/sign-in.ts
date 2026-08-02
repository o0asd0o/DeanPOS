import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "../../common/password.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertSession } from "../db-operations/commands/insert-session.command.ts";
import { findUserByEmailForSignIn } from "../db-operations/queries/find-user-by-email-for-sign-in.query.ts";
import { SESSION_ABSOLUTE_TTL_MS } from "../session-policy.ts";

export const inputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type SignInInput = z.infer<typeof inputSchema>;
type SignInResult =
  | { ok: true; mustChangePassword: boolean; sessionId: string; expiresAt: Date }
  | { ok: false };

// One failure shape for every cause, never distinguished in message or
// timing (issue 03 acceptance criterion 5; record 030): `verifyPassword`
// always runs once, against the real hash or a fixed dummy one.
export const handler: Handler<SignInInput, SignInResult> = async ({ ctx, input }) => {
  const user = await findUserByEmailForSignIn(ctx.db, input.email);
  const passwordOk = await verifyPassword(
    input.password,
    user?.password_hash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !user.active || !passwordOk) return { ok: false };

  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_ABSOLUTE_TTL_MS);

  await withTenantScope(ctx.db, user.tenant_id, (db) =>
    insertSession(db, { id: sessionId, userId: user.id, tenantId: user.tenant_id, expiresAt }),
  );

  return { ok: true, mustChangePassword: user.must_change_password, sessionId, expiresAt };
};
