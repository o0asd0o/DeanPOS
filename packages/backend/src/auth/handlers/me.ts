import { z } from "zod";

import type { Handler } from "../../common/handler.ts";

export const inputSchema = z.void();

type MeOutput = { authenticated: false } | { authenticated: true; mustChangePassword: boolean };

// What the client asks instead of reading the (httpOnly, unreadable) cookie
// itself — the `_shell` route's `beforeLoad` guard is built on this.
export const handler: Handler<void, MeOutput> = async ({ ctx }) => {
  if (ctx.kind !== "tenant") return { authenticated: false };
  return { authenticated: true, mustChangePassword: ctx.principal.mustChangePassword ?? false };
};
