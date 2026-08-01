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
export const createTestSeam = (options: TestSeamOptions = {}) => {
  const databaseUrl = options.databaseUrl ?? requireEnv(ENV_KEYS.databaseUrl);
  const appDomain = options.appDomain ?? requireEnv(ENV_KEYS.appDomain);

  const db = createDb({ databaseUrl });
  const app = createApp({ db, appDomain, devOrigins: options.devOrigins });

  const client = createClient({
    url: `https://api.${appDomain}/rpc`,
    fetch: async (request, init) => app.request(request, init),
  });

  return { app, client, db };
};
