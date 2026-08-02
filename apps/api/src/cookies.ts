// The only place the session cookie's name and attributes are declared —
// issue 03 acceptance criterion 2.
export const SESSION_COOKIE_NAME = "deanpos_session";

export const buildSessionCookie = (
  appDomain: string,
  sessionId: string,
  expiresAt: Date,
): string => {
  const maxAgeSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    "Path=/",
    `Domain=.${appDomain}`,
    `Expires=${expiresAt.toUTCString()}`,
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
};

// Sign-out sets this regardless of whether a session row existed to revoke
// — the cookie alone cannot resurrect a revoked session, but it should not
// linger in the browser either.
export const buildExpiredSessionCookie = (appDomain: string): string =>
  [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    `Domain=.${appDomain}`,
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");

export const parseSessionCookie = (cookieHeader: string | undefined | null): string | null => {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME) return rest.join("=") || null;
  }
  return null;
};
