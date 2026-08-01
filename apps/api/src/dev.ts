import { createDb } from "backend/src/db/client.ts";

import { createApp } from "./app.ts";
import { loadEnv } from "./env.ts";

// The development entry point. It exists so the two Vite dev-server origins are admitted by a
// file the production image never runs: docker/api.Dockerfile's CMD is
// `bun run apps/api/src/index.ts`, and index.ts passes no devOrigins. Record 012.
const env = loadEnv();
const db = createDb({ databaseUrl: env.databaseUrl });

const app = createApp({
  db,
  appDomain: env.appDomain,
  // Literals, never configuration. These ports are pinned by `server.strictPort`
  // in each front end's vite.config.ts — record 012.
  devOrigins: ["http://localhost:6003", "http://localhost:6004"],
});

export default { port: 6001, fetch: app.fetch };
