const EXEMPT_PATHS = ["/rpc/auth/setPassword", "/rpc/auth/signOut", "/rpc/auth/me"];

// A stuck User (temporary password not yet changed) may still reach
// exactly these three: setting the new password, signing out, and
// checking its own session state.
export const isMustChangePasswordExempt = (requestPath: string): boolean =>
  EXEMPT_PATHS.includes(requestPath);
