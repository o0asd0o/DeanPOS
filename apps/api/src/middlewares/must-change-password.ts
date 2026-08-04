const EXEMPT_PATHS = [
  "/rpc/auth/signIn",
  "/rpc/auth/setPassword",
  "/rpc/auth/changePassword",
  "/rpc/auth/signOut",
  "/rpc/auth/me",
];

// A stuck User (temporary password not yet changed) may still reach exactly
// these five. signIn is one of them because the stale cookie rides along on
// the sign-in request, and refusing it strands the User on the login screen.
// changePassword is exempt at this layer so its own handler can return
// `{ ok: false, reason: "refused" }` (record 065 §5) rather than a bare 403.
export const isMustChangePasswordExempt = (requestPath: string): boolean =>
  EXEMPT_PATHS.includes(requestPath);
