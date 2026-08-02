import { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { hashPassword } from "../../common/password.ts";
import { withTenantScope } from "../../db/client.ts";
import { updateUserPassword } from "../db-operations/commands/update-user-password.command.ts";

// No password policy exists anywhere in the repository (record 030 refused
// to invent one); the server accepts any non-empty password and is the
// only authority on it. The confirm-match check is client-side only.
export const inputSchema = z.object({ newPassword: z.string().min(1) });

type SetPasswordInput = z.infer<typeof inputSchema>;

export const handler: Handler<SetPasswordInput, { ok: boolean }> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId) return { ok: false };
  // Record 030 omitted a current-password field on the premise the user
  // "proved it at sign-in seconds ago" — true only for the forced-change
  // flow. Without this guard a long-lived stolen session could reset the
  // password with no re-verification at all.
  if (!ctx.principal.mustChangePassword) return { ok: false };

  const passwordHash = await hashPassword(input.newPassword);
  const userId = ctx.principal.userId;
  await withTenantScope(ctx.db, ctx.principal.tenantId, (db) =>
    updateUserPassword(db, userId, passwordHash),
  );

  return { ok: true };
};
