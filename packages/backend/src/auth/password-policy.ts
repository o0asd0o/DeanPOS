// Password policy, record 032. Re-exports the canonical schemas/src/password.ts
// under this backend's session-policy.ts-style import path.
export {
  normalizePassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordSchema,
  signInPasswordSchema,
} from "schemas/src/password.ts";
