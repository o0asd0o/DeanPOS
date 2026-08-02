// The only place the session cookie's name and attributes are declared —
// issue 03 acceptance criterion 2.
export const SESSION_COOKIE_NAME = "deanpos_session";

// The Vite dev servers are plain http on bare `localhost`, where a browser
// drops any cookie carrying `Secure` or a `Domain` it is not under. `dev` is
// true only for src/dev.ts's devOrigins — index.ts passes none (record 012).
const scopeAttributes = (appDomain: string, dev: boolean): string[] =>
  dev ? [] : [`Domain=.${appDomain}`, "Secure"];

export const buildSessionCookie = (
  appDomain: string,
  sessionId: string,
  expiresAt: Date,
  dev = false,
): string => {
  const maxAgeSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    "Path=/",
    `Expires=${expiresAt.toUTCString()}`,
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "SameSite=Lax",
    ...scopeAttributes(appDomain, dev),
  ].join("; ");
};

// Sign-out sets this regardless of whether a session row existed to revoke
// — the cookie alone cannot resurrect a revoked session, but it should not
// linger in the browser either.
export const buildExpiredSessionCookie = (appDomain: string, dev = false): string =>
  [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
    ...scopeAttributes(appDomain, dev),
  ].join("; ");

export const parseSessionCookie = (cookieHeader: string | undefined | null): string | null => {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME) return rest.join("=") || null;
  }
  return null;
};
