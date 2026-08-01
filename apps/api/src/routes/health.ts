import type { Context } from "hono";
import type { Ctx } from "backend/src/common/ctx.ts";
import { handler as healthHandler } from "backend/src/health/handlers/get-health.ts";

/** Plain HTTP, not an oRPC procedure — infra checks call it directly, with no typed client. */
export const healthRoute = async (c: Context<{ Variables: { ctx: Ctx } }>) => {
  const health = await healthHandler({ ctx: c.get("ctx"), input: undefined });
  return c.json(health);
};
