const EXEMPT_PATHS = ["/rpc/auth/setPassword", "/rpc/auth/signOut", "/rpc/auth/me"];

// A stuck User (temporary password not yet changed) may still reach
// exactly these two: setting the new password, and signing out.
export const isMustChangePasswordExempt = (requestPath: string): boolean =>
  EXEMPT_PATHS.includes(requestPath);
