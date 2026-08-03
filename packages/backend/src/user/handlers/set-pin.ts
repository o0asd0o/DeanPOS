import { pinSchema } from "contract/src/contract.ts";
import { hashPin } from "contract/src/pin.ts";
import { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setUserPin } from "../db-operations/commands/set-user-pin.command.ts";

export const inputSchema = z.object({ pin: pinSchema });
type SetPinInput = z.infer<typeof inputSchema>;

// Self-service, cookie/tenant session (issue 10, record 058) — covers first
// use and change alike; no procedure ever verifies a submitted PIN. `{ ok }`
// only — the hash never rides the response.
export const handler: Handler<SetPinInput, { ok: boolean }> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId) return { ok: false };
  const { tenantId, userId } = ctx.principal;

  const newHash = await hashPin(input.pin);
  const updated = await withTenantScope(ctx.db, tenantId, (scopedDb) =>
    setUserPin(scopedDb, userId, newHash),
  );

  return { ok: updated !== undefined };
};
