import { requireEnv } from "./helpers.ts";

export type Env = {
  databaseUrl: string;
  appDomain: string;
};

export const ENV_KEYS = {
  // The app connects as the restricted role, never the migration owner
  // (DATABASE_URI) — issue 01, tenant-isolation-spine.
  databaseUrl: "APP_DATABASE_URI",
  appDomain: "APP_DOMAIN",
} as const;

// ADR-0008: typed environment.
export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => ({
  databaseUrl: requireEnv(ENV_KEYS.databaseUrl, source),
  appDomain: requireEnv(ENV_KEYS.appDomain, source),
});
