import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { resetUserPin } from "../db-operations/commands/reset-user-pin.command.ts";

export const inputSchema = z.object({ id: z.string() });
type ResetPinInput = z.infer<typeof inputSchema>;

// `admin` only. Clears the hash to NULL — no temporary PIN is minted, and
// no PIN is ever written into this response, only `{ ok }` (issue 10).
export const handler: Handler<ResetPinInput, { ok: boolean }> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return { ok: false };
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return { ok: false };

  const updated = await withTenantScope(ctx.db, tenantId, (scopedDb) =>
    resetUserPin(scopedDb, input.id),
  );

  return { ok: updated !== undefined };
};
