import type { Ctx, PlatformAdminPrincipal, Principal } from "backend/src/common/ctx.ts";
import type { DatabaseInstance } from "backend/src/db/client.ts";

/** Builds Ctx once per app instance, not per request (issue 03 moves this): db is tenant-scoped by app.ts, principal is what it was scoped from (ADR-0008). */
export const createContext = (
  db: DatabaseInstance,
  principal: Principal | null = null,
  platformAdmin: PlatformAdminPrincipal | null = null,
): Ctx => ({
  db,
  principal,
  platformAdmin,
});
