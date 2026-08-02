const EXEMPT_PATHS = [
  "/rpc/auth/signIn",
  "/rpc/auth/setPassword",
  "/rpc/auth/signOut",
  "/rpc/auth/me",
];

// A stuck User (temporary password not yet changed) may still reach exactly
// these four. signIn is one of them because the stale cookie rides along on
// the sign-in request, and refusing it strands the User on the login screen.
export const isMustChangePasswordExempt = (requestPath: string): boolean =>
  EXEMPT_PATHS.includes(requestPath);
