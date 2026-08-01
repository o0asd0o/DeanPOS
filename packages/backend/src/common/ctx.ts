import type { DatabaseInstance } from "../db/client.ts";

// Built per request by apps/api/src/context.ts. ADR-0008.
export type Ctx = {
  db: DatabaseInstance;
};
