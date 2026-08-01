import type { Ctx } from "backend/src/common/ctx.ts";
import type { DatabaseInstance } from "backend/src/db/client.ts";

/** Builds the request Ctx: db, principal, tenant (ADR-0008). Only `db` exists until later areas add auth and tenancy. */
export const createContext = (db: DatabaseInstance): Ctx => ({ db });
