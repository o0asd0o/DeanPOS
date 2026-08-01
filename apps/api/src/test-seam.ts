import { createDb } from "backend/src/db/client.ts";
import { createClient } from "contract/src/index.ts";

import { createApp } from "./app.ts";

export type TestSeamOptions = {
  /** Override to point at a broken database and force an opaque-error response. */
  databaseUrl?: string;
  /** Override to exercise a non-allowlisted CORS origin. */
  appDomain?: string;
};

/**
 * The server half of the one test seam (foundation PRD "Testing Decisions").
 * Builds a real Hono app over a real (or deliberately broken) database, and
 * a real oRPC client whose `fetch` dispatches straight into that app via
 * `app.request()` — no port, no running server, no mock. `app` is exposed
 * too, for assertions the typed client abstracts away (response headers,
 * status codes).
 *
 * Lives here, not in `packages/contract`, because it needs the assembled
 * Hono application; `apps/pos` and `apps/backoffice` (issues 06, 07) import
 * it as a `devDependency` on `api`, which is the only sanctioned way `pg`,
 * `hono`, and `@orpc/server` may reach a front end's dependency graph
 * (.scratch/decisions/006).
 */
export const createTestSeam = (options: TestSeamOptions = {}) => {
  const databaseUrl = options.databaseUrl ?? requireEnv("DATABASE_URI");
  const appDomain = options.appDomain ?? requireEnv("APP_DOMAIN");

  const db = createDb({ databaseUrl });
  const app = createApp({ db, appDomain });

  const client = createClient({
    url: `https://api.${appDomain}/rpc`,
    fetch: async (request, init) => app.request(request, init),
  });

  return { app, client, db };
};

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};
