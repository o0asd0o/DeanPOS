import { implement } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import type { Ctx, PlatformAdminPrincipal, Principal } from "backend/src/common/ctx.ts";
import type { DatabaseInstance } from "backend/src/db/client.ts";
import { contract } from "contract/src/index.ts";
import { toSafeErrorResponse } from "error/src/index.ts";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { createContext } from "./context.ts";
import { allowedOrigins } from "./middlewares/cors.ts";
import { healthRoute } from "./routes/health.ts";
import { provisionTenantRoute } from "./routes/platform-admin.ts";
import { pingRoute } from "./routes/ping.ts";
import { storeGetRoute } from "./routes/store.ts";

export type CreateAppOptions = {
  db: DatabaseInstance;
  appDomain: string;
  /** Extra origins, passed only by src/dev.ts. index.ts passes none — record 012. */
  devOrigins?: string[];
  /**
   * Fixes every request through this app instance to one principal. No
   * client-controlled path to a tenant exists until issue 03 builds sessions
   * — the test seam is the only caller of this, one app instance per actor
   * (apps/api/src/test-seam.ts). Production never passes it.
   */
  principal?: Principal | null;
  /** Same shape as `principal`, for a platform-admin actor (issue 02) — a distinct principal, never a Tenant's. */
  platformAdmin?: PlatformAdminPrincipal | null;
};

/** Assembles the Hono shell (ADR-0008). Used by the production entry and, unchanged, by the in-process test seam. */
export const createApp = ({
  db,
  appDomain,
  devOrigins = [],
  principal = null,
  platformAdmin = null,
}: CreateAppOptions) => {
  const ctx = createContext(db, principal, platformAdmin);
  const app = new Hono<{ Variables: { ctx: Ctx } }>();

  app.use("*", cors({ origin: [...allowedOrigins(appDomain), ...devOrigins] }));
  app.use("*", async (c, next) => {
    c.set("ctx", ctx);
    await next();
  });

  app.get("/health", healthRoute);

  // .router() requires every contract key present — .scratch/decisions/006.
  const router = implement(contract)
    .$context<Ctx>()
    .router({
      ping: pingRoute,
      store: { get: storeGetRoute },
      platformAdmin: { provisionTenant: provisionTenantRoute },
    });
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
