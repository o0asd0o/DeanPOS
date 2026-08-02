import type { Principal } from "backend/src/common/ctx.ts";
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

  const buildActor = (principal: Principal | null) => {
    const app = createApp({ db, appDomain, devOrigins: options.devOrigins, principal });
    const client = createClient({
      url: `https://api.${appDomain}/rpc`,
      fetch: async (request, init) => app.request(request, init),
    });
    return { app, client };
  };

  const { app, client } = buildActor(null);

  return {
    app,
    client,
    db,
    actors: {
      asTenant: (tenantId: string) => buildActor({ tenantId }),
      asUnauthenticated: () => buildActor(null),
    },
  };
};
