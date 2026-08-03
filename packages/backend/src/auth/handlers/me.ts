import { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import type { Role } from "../../db/prisma/generated/types.ts";

export const inputSchema = z.void();

type MeOutput =
  | { authenticated: false }
  | { authenticated: true; mustChangePassword: boolean; role: Role };

// What the client asks instead of reading the (httpOnly, unreadable) cookie
// itself — the `_shell` route's `beforeLoad` guard is built on this. `role`
// is carried from issue 05 on: the Stores screen needs it to know whether
// the caller is an `admin` (record 038 §6). A tenant session that somehow
// carries no role reads as unauthenticated, the same as no session at all.
export const handler: Handler<void, MeOutput> = async ({ ctx }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return { authenticated: false };
  return {
    authenticated: true,
    mustChangePassword: ctx.principal.mustChangePassword ?? false,
    role: ctx.principal.role,
  };
};
