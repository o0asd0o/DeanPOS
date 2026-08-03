import { implement, ORPCError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ResponseHeadersPlugin } from "@orpc/server/plugins";
import type {
  Ctx,
  DevicePrincipal,
  PlatformAdminPrincipal,
  Principal,
} from "backend/src/common/ctx.ts";
import type { DatabaseInstance } from "backend/src/db/client.ts";
import { contract } from "contract/src/index.ts";
import { toSafeErrorResponse } from "error/src/index.ts";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { buildContextFromDeviceToken, buildContextFromSession, createContext } from "./context.ts";
import { parseSessionCookie } from "./cookies.ts";
import { allowedOrigins } from "./middlewares/cors.ts";
import { isMustChangePasswordExempt } from "./middlewares/must-change-password.ts";
import { createAuthRoutes } from "./routes/auth.ts";
import {
  deviceCancelCodeRoute,
  deviceGenerateCodeRoute,
  deviceListRoute,
  devicePendingCodesRoute,
  deviceRenameRoute,
  deviceRevokeRoute,
  terminalEnrolRoute,
  terminalHeartbeatRoute,
  terminalMeRoute,
  terminalPinSyncRoute,
} from "./routes/device.ts";
import { healthRoute } from "./routes/health.ts";
import { provisionTenantRoute } from "./routes/platform-admin.ts";
import {
  paymentMethodCreateRoute,
  paymentMethodDeactivateRoute,
  paymentMethodListRoute,
  paymentMethodReactivateRoute,
  paymentMethodUpdateRoute,
} from "./routes/payment-method.ts";
import { pingRoute } from "./routes/ping.ts";
import { settingsGetRoute, settingsUpdateRoute } from "./routes/settings.ts";
import {
  storeCreateRoute,
  storeDeactivateRoute,
  storeGetRoute,
  storeListRoute,
  storeReactivateRoute,
  storeUpdateRoute,
} from "./routes/store.ts";
import {
  userCreateRoute,
  userDeactivateRoute,
  userListRoute,
  userReactivateRoute,
  userResetPasswordRoute,
  userResetPinRoute,
  userSetPinRoute,
  userUpdateRoute,
} from "./routes/user.ts";

export type CreateAppOptions = {
  db: DatabaseInstance;
  appDomain: string;
  /** Extra origins, passed only by src/dev.ts. index.ts passes none — record 012. */
  devOrigins?: string[];
  /** Test-seam-only: bypasses the cookie/Origin machinery below (apps/api/src/test-seam.ts). Production never passes it. */
  principal?: Principal | null;
  /** Same shape as `principal`, for a platform-admin actor (issue 02) — a distinct principal, never a Tenant's. */
  platformAdmin?: PlatformAdminPrincipal | null;
  /** Same shape as `principal`, for a Device actor (issue 09) — a distinct principal, never a Tenant's User. */
  device?: DevicePrincipal | null;
};

const ADMIN_ORIGIN = (appDomain: string) => `https://admin.${appDomain}`;

/** Assembles the Hono shell (ADR-0008). Used by the production entry and, unchanged, by the in-process test seam. */
export const createApp = ({
  db,
  appDomain,
  devOrigins = [],
  principal = null,
  platformAdmin = null,
  device = null,
}: CreateAppOptions) => {
  const app = new Hono<{ Variables: { ctx: Ctx } }>();
  const testSeamActor = principal || platformAdmin || device;

  // credentials: true is required for the session cookie to survive the
  // cross-subdomain request (issue 03) — without it the browser discards
  // Set-Cookie regardless of the cookie's own attributes.
  app.use("*", cors({ origin: [...allowedOrigins(appDomain), ...devOrigins], credentials: true }));

  // No identity concept applies to a liveness check — always unauthenticated.
  // clientIp is unused on this path; the same absent-header literal as /rpc
  // keeps the field's meaning consistent everywhere it's set.
  app.use("/health", async (c, next) => {
    c.set("ctx", { db, clientIp: "no-forwarded-for", kind: "unauthenticated" });
    await next();
  });
  app.get("/health", healthRoute);

  // devOrigins are the one dev switch this app has, so they also decide the
  // cookie's attributes and which origins may present it (record 012).
  const cookieOrigins = [ADMIN_ORIGIN(appDomain), ...devOrigins];
  const authRoutes = createAuthRoutes(appDomain, devOrigins.length > 0);

  // .router() requires every contract key present — .scratch/decisions/006.
  const router = implement(contract)
    .$context<Ctx>()
    .router({
      ping: pingRoute,
      store: {
        get: storeGetRoute,
        list: storeListRoute,
        create: storeCreateRoute,
        update: storeUpdateRoute,
        deactivate: storeDeactivateRoute,
        reactivate: storeReactivateRoute,
      },
      user: {
        list: userListRoute,
        create: userCreateRoute,
        update: userUpdateRoute,
        deactivate: userDeactivateRoute,
        reactivate: userReactivateRoute,
        resetPassword: userResetPasswordRoute,
        setPin: userSetPinRoute,
        resetPin: userResetPinRoute,
      },
      paymentMethod: {
        list: paymentMethodListRoute,
        create: paymentMethodCreateRoute,
        update: paymentMethodUpdateRoute,
        deactivate: paymentMethodDeactivateRoute,
        reactivate: paymentMethodReactivateRoute,
      },
      settings: { get: settingsGetRoute, update: settingsUpdateRoute },
      platformAdmin: { provisionTenant: provisionTenantRoute },
      auth: authRoutes,
      // Cookie/admin (issue 09, record 056 Q6) — never accepts a Device token.
      device: {
        list: deviceListRoute,
        pendingCodes: devicePendingCodesRoute,
        cancelCode: deviceCancelCodeRoute,
        generateCode: deviceGenerateCodeRoute,
        rename: deviceRenameRoute,
        revoke: deviceRevokeRoute,
      },
      // The terminal's own key — `enrol` unauthenticated, the rest Device-token.
      terminal: {
        enrol: terminalEnrolRoute,
        me: terminalMeRoute,
        heartbeat: terminalHeartbeatRoute,
        pinSync: terminalPinSyncRoute,
      },
    });
  const rpcHandler = new RPCHandler(router, { plugins: [new ResponseHeadersPlugin()] });

  app.use("/rpc/*", async (c, next) => {
    // Trustworthy only because docker-compose.yml never publishes the api
    // service — Caddy is the sole ingress. Absent when unproxied (src/dev.ts);
    // every such request then shares one bucket, failing closed (record 033).
    const clientIp = c.req.header("X-Forwarded-For") ?? "no-forwarded-for";

    // Ctx is built per request, not once per app instance (issue 03).
    let ctx: Ctx;
    if (testSeamActor) {
      ctx = createContext(db, clientIp, principal, platformAdmin, device);
    } else {
      // A device-token request (issue 09) carries `Authorization`, never the
      // session cookie's identity — the Origin gate below is cookie-CSRF
      // defence and must not refuse a request that never relied on it.
      const authHeader = c.req.header("Authorization");
      const isDeviceTokenRequest = authHeader !== undefined;
      if (isDeviceTokenRequest) {
        // Scheme matched case-insensitively; anything else resolves to
        // unauthenticated rather than an error (record 056 Q2).
        const match = /^bearer\s+(.+)$/i.exec(authHeader);
        ctx = await buildContextFromDeviceToken(db, match ? match[1]! : null, clientIp);
      } else {
        const sessionId = parseSessionCookie(c.req.header("Cookie"));
        if (sessionId) {
          // A missing Origin is a refusal, not a pass — PRD security criterion 20.
          if (!cookieOrigins.includes(c.req.header("Origin") ?? "")) {
            return c.json(toSafeErrorResponse(new ORPCError("FORBIDDEN")), 403);
          }
          ctx = await buildContextFromSession(db, sessionId, clientIp);
        } else {
          ctx = { db, clientIp, kind: "unauthenticated" };
        }
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
