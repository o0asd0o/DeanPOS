import { deviceCtx } from "../../common/ctx.ts";
import type { Handler } from "../../common/handler.ts";

// Device-token only. `last_seen_at` is already touched inside
// `buildContextFromDeviceToken` — this exists only so the POS has something
// to call on mount (record 056 smaller call 6); it does no extra work.
export const handler: Handler<void, { ok: boolean }> = async ({ ctx }) => {
  const deviceCtxValue = deviceCtx(ctx);
  return { ok: deviceCtxValue !== null };
};
