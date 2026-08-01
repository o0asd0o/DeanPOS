import { implement } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import type { Ctx } from "backend/src/common/ctx.ts";
import type { DatabaseInstance } from "backend/src/db/client.ts";
import { contract } from "contract/src/index.ts";
import { toSafeErrorResponse } from "error/src/index.ts";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { createContext } from "./context.ts";
import { allowedOrigins } from "./middlewares/cors.ts";
import { healthRoute } from "./routes/health.ts";
import { pingRoute } from "./routes/ping.ts";

export type CreateAppOptions = {
  db: DatabaseInstance;
  appDomain: string;
  /** Extra origins, passed only by src/dev.ts. index.ts passes none — record 012. */
  devOrigins?: string[];
};

/** Assembles the Hono shell (ADR-0008). Used by the production entry and, unchanged, by the in-process test seam. */
export const createApp = ({ db, appDomain, devOrigins = [] }: CreateAppOptions) => {
  const ctx = createContext(db);
  const app = new Hono<{ Variables: { ctx: Ctx } }>();

  app.use("*", cors({ origin: [...allowedOrigins(appDomain), ...devOrigins] }));
  app.use("*", async (c, next) => {
    c.set("ctx", ctx);
    await next();
  });

  app.get("/health", healthRoute);

  // .router() requires every contract key present — .scratch/decisions/006.
  const router = implement(contract).$context<Ctx>().router({ ping: pingRoute });
  const rpcHandler = new RPCHandler(router);

  app.use("/rpc/*", async (c, next) => {
    const { matched, response } = await rpcHandler.handle(c.req.raw, {
      prefix: "/rpc",
      context: ctx,
    });
    if (matched) return response;
    await next();
  });

  app.onError((error, c) => c.json(toSafeErrorResponse(error), 500));

  return app;
};
