import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { expireEnrolmentCode } from "../db-operations/commands/expire-enrolment-code.command.ts";

export const inputSchema = z.object({ id: z.string() });
type CancelCodeInput = z.infer<typeof inputSchema>;

// `admin` only, like every other `device.*` call (record 056 §"Smaller calls" 5).
// Writes no audit row: the `field` check constraint admits three values and a
// fourth needs a migration — worth one if cancellations ever need a trail.
export const handler: Handler<CancelCodeInput, { ok: boolean }> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return { ok: false };
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return { ok: false };

  const expired = await withTenantScope(ctx.db, tenantId, (scopedDb) =>
    expireEnrolmentCode(scopedDb, input.id),
  );
  return { ok: expired };
};
