import { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { revokeSession } from "../db-operations/commands/revoke-session.command.ts";

export const inputSchema = z.void();

// Revokes the row, not just the cookie (issue 03 acceptance criterion 3).
// No session to revoke (already signed out, or never signed in) is not an
// error — sign-out is idempotent.
export const handler: Handler<void, { ok: true }> = async ({ ctx }) => {
  if (ctx.kind === "tenant" && ctx.principal.sessionId) {
    const sessionId = ctx.principal.sessionId;
    await withTenantScope(ctx.db, ctx.principal.tenantId, (db) => revokeSession(db, sessionId));
  }
  return { ok: true };
};
