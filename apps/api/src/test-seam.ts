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
// `actors` adds the ability to construct a request as a given Tenant's caller
// or as an unauthenticated caller — issue 01, tenant-isolation-spine. No
// second copy of the app/client setup: every actor is built by the same
// `buildActor`, the base `app`/`client` included.
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

  return {
    app,
    client,
    db,
    actors: {
      asTenant: (tenantId: string) => buildActor({ principal: { tenantId } }),
      asPlatformAdmin: (platformAdminId: string) =>
        buildActor({ platformAdmin: { platformAdminId } }),
      asUnauthenticated: () => buildActor({}),
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
