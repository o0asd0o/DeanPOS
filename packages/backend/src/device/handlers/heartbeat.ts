import { deviceCtx } from "../../common/ctx.ts";
import type { Handler } from "../../common/handler.ts";

// Device-token only. `last_seen_at` is already touched on every Device-token
// request inside `buildContextFromDeviceToken` (issue 09 acceptance
// criteria) — this procedure exists only so the POS has something to call
// once on mount (record 056 smaller call 6); it does no extra work itself.
export const handler: Handler<void, { ok: boolean }> = async ({ ctx }) => {
  const deviceCtxValue = deviceCtx(ctx);
  return { ok: deviceCtxValue !== null };
};
