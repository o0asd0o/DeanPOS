import type { Ctx, Principal } from "backend/src/common/ctx.ts";
import type { DatabaseInstance } from "backend/src/db/client.ts";

/** Builds the request Ctx: db (already tenant-scoped by app.ts) and the principal it was scoped from (ADR-0008). */
export const createContext = (db: DatabaseInstance, principal: Principal | null = null): Ctx => ({
  db,
  principal,
});
