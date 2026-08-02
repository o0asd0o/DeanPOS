// Password policy, record 032. Canonical source lives in packages/schemas
// so the contract package can import it too without depending on backend —
// this file re-exports it under the local, session-policy.ts-style path
// every handler here imports from.
export {
  normalizePassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordSchema,
  signInPasswordSchema,
} from "schemas/src/password.ts";
