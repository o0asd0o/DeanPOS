import { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import type { Role } from "../../db/prisma/generated/types.ts";

export const inputSchema = z.void();

type MeOutput =
  | { authenticated: false }
  | { authenticated: true; mustChangePassword: boolean; role: Role; userId?: string };

// What `_shell`'s `beforeLoad` guard reads (record 030). `role` (record 038
// §6) and `userId` (record 044 §4 clause 2) feed the Stores/Users screens.
export const handler: Handler<void, MeOutput> = async ({ ctx }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return { authenticated: false };
  return {
    authenticated: true,
    mustChangePassword: ctx.principal.mustChangePassword ?? false,
    role: ctx.principal.role,
    userId: ctx.principal.userId,
  };
};
