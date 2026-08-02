import { implement, ORPCError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ResponseHeadersPlugin } from "@orpc/server/plugins";
import type { Ctx, PlatformAdminPrincipal, Principal } from "backend/src/common/ctx.ts";
import type { DatabaseInstance } from "backend/src/db/client.ts";
import { contract } from "contract/src/index.ts";
import { toSafeErrorResponse } from "error/src/index.ts";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { buildContextFromSession, createContext } from "./context.ts";
import { parseSessionCookie } from "./cookies.ts";
import { allowedOrigins } from "./middlewares/cors.ts";
import { isMustChangePasswordExempt } from "./middlewares/must-change-password.ts";
import { createAuthRoutes } from "./routes/auth.ts";
import { healthRoute } from "./routes/health.ts";
import { provisionTenantRoute } from "./routes/platform-admin.ts";
import { pingRoute } from "./routes/ping.ts";
import { storeGetRoute } from "./routes/store.ts";

export type CreateAppOptions = {
  db: DatabaseInstance;
  appDomain: string;
  /** Extra origins, passed only by src/dev.ts. index.ts passes none — record 012. */
  devOrigins?: string[];
  /** Test-seam-only: bypasses the cookie/Origin machinery below (apps/api/src/test-seam.ts). Production never passes it. */
  principal?: Principal | null;
  /** Same shape as `principal`, for a platform-admin actor (issue 02) — a distinct principal, never a Tenant's. */
  platformAdmin?: PlatformAdminPrincipal | null;
};

const ADMIN_ORIGIN = (appDomain: string) => `https://admin.${appDomain}`;

/** Assembles the Hono shell (ADR-0008). Used by the production entry and, unchanged, by the in-process test seam. */
export const createApp = ({
  db,
  appDomain,
  devOrigins = [],
  principal = null,
  platformAdmin = null,
}: CreateAppOptions) => {
  const app = new Hono<{ Variables: { ctx: Ctx } }>();
  const testSeamActor = principal || platformAdmin;

  app.use("*", cors({ origin: [...allowedOrigins(appDomain), ...devOrigins] }));

  // No identity concept applies to a liveness check — always unauthenticated.
  app.use("/health", async (c, next) => {
    c.set("ctx", { db, kind: "unauthenticated" });
    await next();
  });
  app.get("/health", healthRoute);

  const authRoutes = createAuthRoutes(appDomain);

  // .router() requires every contract key present — .scratch/decisions/006.
  const router = implement(contract)
    .$context<Ctx>()
    .router({
      ping: pingRoute,
      store: { get: storeGetRoute },
      platformAdmin: { provisionTenant: provisionTenantRoute },
      auth: authRoutes,
    });
  const rpcHandler = new RPCHandler(router, { plugins: [new ResponseHeadersPlugin()] });

  app.use("/rpc/*", async (c, next) => {
    // Ctx is built per request, not once per app instance (issue 03).
    let ctx: Ctx;
    if (testSeamActor) {
      ctx = createContext(db, principal, platformAdmin);
    } else {
      const sessionId = parseSessionCookie(c.req.header("Cookie"));
      if (sessionId) {
        // A missing Origin is a refusal, not a pass — PRD security criterion 20.
        if (c.req.header("Origin") !== ADMIN_ORIGIN(appDomain)) {
          return c.json(toSafeErrorResponse(new ORPCError("FORBIDDEN")), 403);
        }
        ctx = await buildContextFromSession(db, sessionId);
      } else {
        ctx = { db, kind: "unauthenticated" };
      }
    }
    c.set("ctx", ctx);

    // Issue 03 acceptance criterion 6, covering every procedure from one place.
    if (
      ctx.kind === "tenant" &&
      ctx.principal.mustChangePassword &&
      !isMustChangePasswordExempt(c.req.path)
    ) {
      return c.json(toSafeErrorResponse(new ORPCError("FORBIDDEN")), 403);
    }

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
