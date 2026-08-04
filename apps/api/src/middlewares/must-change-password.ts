const EXEMPT_PATHS = [
  "/rpc/auth/signIn",
  "/rpc/auth/setPassword",
  "/rpc/auth/changePassword",
  "/rpc/auth/signOut",
  "/rpc/auth/me",
];

// A stuck User may still reach exactly these five; changePassword is
// exempt here so its own handler returns reason: "refused" itself.
// .scratch/decisions/065 §5.
export const isMustChangePasswordExempt = (requestPath: string): boolean =>
  EXEMPT_PATHS.includes(requestPath);
