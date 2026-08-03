import { randomUUID } from "node:crypto";

import type {
  Ctx,
  DevicePrincipal,
  PlatformAdminPrincipal,
  Principal,
} from "backend/src/common/ctx.ts";
import { createDb } from "backend/src/db/client.ts";
import { createClient } from "contract/src/index.ts";

import { createApp } from "./app.ts";
import { ENV_KEYS } from "./env.ts";
import { requireEnv } from "./helpers.ts";

export type TestSeamOptions = {
  databaseUrl?: string;
  appDomain?: string;
  devOrigins?: string[];
  /** `null` sends no X-Forwarded-For, which is the unproxied production case. */
  clientIp?: string | null;
};

// The server half of the one test seam. foundation PRD "Testing Decisions"; .scratch/decisions/006.
// Every actor is built by the same `buildActor`, the base `app`/`client` included.
export const createTestSeam = (options: TestSeamOptions = {}) => {
  const databaseUrl = options.databaseUrl ?? requireEnv(ENV_KEYS.databaseUrl);
  const appDomain = options.appDomain ?? requireEnv(ENV_KEYS.appDomain);

  const db = createDb({ databaseUrl });

  // One throttle bucket per seam. Without this every test in the repo shares
  // `ip:no-forwarded-for`, and a few consecutive runs push that one row past
  // IP_FAILURE_LIMIT — after which every sign-in in the suite is refused
  // (records 033, 034).
  const clientIp = options.clientIp === undefined ? randomUUID() : options.clientIp;
  const forward = (request: Request) => {
    if (clientIp !== null) request.headers.set("X-Forwarded-For", clientIp);
    return request;
  };

  const buildActor = (actor: {
    principal?: Principal | null;
    platformAdmin?: PlatformAdminPrincipal | null;
    device?: DevicePrincipal | null;
  }) => {
    const app = createApp({
      db,
      appDomain,
      devOrigins: options.devOrigins,
      principal: actor.principal ?? null,
      platformAdmin: actor.platformAdmin ?? null,
      device: actor.device ?? null,
    });
    const client = createClient({
      url: `https://api.${appDomain}/rpc`,
      fetch: async (request, init) => app.request(forward(request), init),
    });
    return { app, client };
  };

  const { app, client } = buildActor({});
  const adminOrigin = `https://admin.${appDomain}`;

  // A cookie-carrying client against the base app — tests the Origin gate
  // and the cookie's own attributes. Mutates the given Request's `Headers`
  // in place rather than reconstructing it: see this issue's `## Comments`.
  const buildCookieClient = (cookieHeader: string | null, origin: string | null) =>
    createClient({
      url: `https://api.${appDomain}/rpc`,
      fetch: async (request) => {
        forward(request);
        if (origin !== null) request.headers.set("Origin", origin);
        else request.headers.delete("Origin");
        if (cookieHeader) request.headers.set("Cookie", cookieHeader);
        return app.request(request);
      },
    });

  // A Device-token client against the base app — the real `Authorization`
  // header path (issue 09), not the direct-principal shortcut below. Proves
  // `buildContextFromDeviceToken` end to end: hash, pre-auth lookup,
  // revocation, and the `last_seen_at` touch.
  const withBearerToken = (token: string | null) =>
    createClient({
      url: `https://api.${appDomain}/rpc`,
      fetch: async (request) => {
        forward(request);
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
        return app.request(request);
      },
    });

  // Signs in for real through the base app instance — the same request path
  // production uses — and captures the Set-Cookie header so callers can
  // both assert on it directly and drive further requests as that session.
  const signIn = async (email: string, password: string) => {
    const captured: { setCookie: string | null; status: number | null; headers: Headers | null } = {
      setCookie: null,
      status: null,
      headers: null,
    };
    const signInClient = createClient({
      url: `https://api.${appDomain}/rpc`,
      fetch: async (request) => {
        forward(request);
        request.headers.set("Origin", adminOrigin);
        const response = await app.request(request);
        captured.setCookie = response.headers.get("Set-Cookie");
        captured.status = response.status;
        captured.headers = response.headers;
        return response;
      },
    });

    const result = await signInClient.auth.signIn({ email, password });
    const sessionCookie = captured.setCookie?.split(";")[0] ?? null;

    return {
      result,
      setCookie: captured.setCookie,
      status: captured.status,
      headers: captured.headers,
      sessionCookie,
      client: buildCookieClient(sessionCookie, adminOrigin),
    };
  };

  return {
    app,
    client,
    db,
    /** The throttle bucket this seam's requests land in (records 033–034). */
    clientIp: clientIp ?? "no-forwarded-for",
    actors: {
      // `role` defaults to "admin" (issue 04) — tests exercising the gate
      // pass `role` and `userId` explicitly, matching a seeded User.
      asTenant: (
        tenantId: string,
        options: {
          mustChangePassword?: boolean;
          userId?: string;
          email?: string;
          role?: Principal["role"];
        } = {},
      ) =>
        buildActor({
          principal: {
            tenantId,
            userId: options.userId,
            email: options.email,
            mustChangePassword: options.mustChangePassword,
            role: options.role ?? "admin",
          },
        }),
      asPlatformAdmin: (platformAdminId: string) =>
        buildActor({ platformAdmin: { platformAdminId } }),
      // Direct-principal shortcut for a Device actor (issue 09) — handler
      // tests that don't need the real header path use this.
      asDevice: (device: DevicePrincipal) => buildActor({ device }),
      asUnauthenticated: () => buildActor({}),
      // Issue 03: a real back-office session, driven through the actual
      // cookie/Origin path rather than the direct-principal shortcut above.
      signIn,
      withCookie: buildCookieClient,
      // Issue 09: a real `Authorization: Bearer <token>` request against the
      // base app — the production path, not the direct-principal shortcut.
      withBearerToken,
      adminOrigin,
    },
    // No actor above can build this — they're exclusive by construction, and
    // createContext throws on both. It exists to prove a handler's own guard
    // refuses a mixed principal even if construction elsewhere didn't.
    buildMixedPrincipalCtx: (tenantId: string, platformAdminId: string): Ctx =>
      ({
        db,
        principal: { tenantId },
        platformAdmin: { platformAdminId },
      }) as unknown as Ctx,
  };
};
