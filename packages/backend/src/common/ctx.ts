import type { DatabaseInstance } from "../db/client.ts";

/**
 * Built once per request by `apps/api/src/context.ts` (ADR-0008). Only `db`
 * is populated so far; `principal` and `tenant` arrive with authentication
 * and tenancy in later areas.
 */
export type Ctx = {
  db: DatabaseInstance;
};
