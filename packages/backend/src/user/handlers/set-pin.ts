import { pinSchema } from "contract/src/contract.ts";
import { hashPin, verifyPin } from "contract/src/pin.ts";
import { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setUserPin } from "../db-operations/commands/set-user-pin.command.ts";
import { findUserPinHash } from "../db-operations/queries/find-user-pin-hash.query.ts";

export const inputSchema = z.object({ pin: pinSchema, currentPin: pinSchema.optional() });
type SetPinInput = z.infer<typeof inputSchema>;

// Self-service: first use sets the PIN outright, a change requires
// `currentPin` to verify first (issue 10 acceptance criterion 1). `{ ok }`
// only — the hash never rides the response.
export const handler: Handler<SetPinInput, { ok: boolean }> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId) return { ok: false };
  const { tenantId, userId } = ctx.principal;

  const ok = await withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const existing = await findUserPinHash(scopedDb, userId);
    if (!existing) return false;

    if (existing.pin_hash) {
      if (!input.currentPin) return false;
      const matches = await verifyPin(input.currentPin, existing.pin_hash);
      if (!matches) return false;
    }

    const newHash = await hashPin(input.pin);
    const updated = await setUserPin(scopedDb, userId, newHash);
    return updated !== undefined;
  });

  return { ok };
};
