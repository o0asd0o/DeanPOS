import { requireEnv } from "./helpers.ts";

export type Env = {
  databaseUrl: string;
  appDomain: string;
};

// ADR-0008: typed environment.
export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => ({
  databaseUrl: requireEnv("DATABASE_URI", source),
  appDomain: requireEnv("APP_DOMAIN", source),
});
