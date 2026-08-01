export type Env = {
  databaseUrl: string;
  appDomain: string;
};

/** Typed environment (ADR-0008). Throws on a missing variable rather than starting half-configured. */
export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const databaseUrl = source.DATABASE_URI;
  const appDomain = source.APP_DOMAIN;

  if (!databaseUrl) throw new Error("DATABASE_URI is not set");
  if (!appDomain) throw new Error("APP_DOMAIN is not set");

  return { databaseUrl, appDomain };
};
