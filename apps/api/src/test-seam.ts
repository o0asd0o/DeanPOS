import type { Ctx, PlatformAdminPrincipal, Principal } from "backend/src/common/ctx.ts";
import { createDb } from "backend/src/db/client.ts";
import { createClient } from "contract/src/index.ts";

import { createApp } from "./app.ts";
import { ENV_KEYS } from "./env.ts";
import { requireEnv } from "./helpers.ts";

export type TestSeamOptions = {
  databaseUrl?: string;
  appDomain?: string;
  devOrigins?: string[];
};

// The server half of the one test seam. foundation PRD "Testing Decisions"; .scratch/decisions/006.
// Every actor is built by the same `buildActor`, the base `app`/`client` included.
export const createTestSeam = (options: TestSeamOptions = {}) => {
  const databaseUrl = options.databaseUrl ?? requireEnv(ENV_KEYS.databaseUrl);
  const appDomain = options.appDomain ?? requireEnv(ENV_KEYS.appDomain);

  const db = createDb({ databaseUrl });

  const buildActor = (actor: {
    principal?: Principal | null;
    platformAdmin?: PlatformAdminPrincipal | null;
  }) => {
    const app = createApp({
      db,
      appDomain,
      devOrigins: options.devOrigins,
      principal: actor.principal ?? null,
      platformAdmin: actor.platformAdmin ?? null,
    });
    const client = createClient({
      url: `https://api.${appDomain}/rpc`,
      fetch: async (request, init) => app.request(request, init),
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
        if (origin !== null) request.headers.set("Origin", origin);
        else request.headers.delete("Origin");
        if (cookieHeader) request.headers.set("Cookie", cookieHeader);
        return app.request(request);
      },
    });

  // Signs in for real through the base app instance — the same request path
  // production uses — and captures the Set-Cookie header so callers can
  // both assert on it directly and drive further requests as that session.
  const signIn = async (email: string, password: string) => {
    const captured: { setCookie: string | null } = { setCookie: null };
    const signInClient = createClient({
      url: `https://api.${appDomain}/rpc`,
      fetch: async (request) => {
        request.headers.set("Origin", adminOrigin);
        const response = await app.request(request);
        captured.setCookie = response.headers.get("Set-Cookie");
        return response;
      },
    });

    const result = await signInClient.auth.signIn({ email, password });
    const sessionCookie = captured.setCookie?.split(";")[0] ?? null;

    return {
      result,
      setCookie: captured.setCookie,
      sessionCookie,
      client: buildCookieClient(sessionCookie, adminOrigin),
    };
  };

  return {
    app,
    client,
    db,
    actors: {
      asTenant: (tenantId: string, options: { mustChangePassword?: boolean } = {}) =>
        buildActor({ principal: { tenantId, mustChangePassword: options.mustChangePassword } }),
      asPlatformAdmin: (platformAdminId: string) =>
        buildActor({ platformAdmin: { platformAdminId } }),
      asUnauthenticated: () => buildActor({}),
      // Issue 03: a real back-office session, driven through the actual
      // cookie/Origin path rather than the direct-principal shortcut above.
      signIn,
      withCookie: buildCookieClient,
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
