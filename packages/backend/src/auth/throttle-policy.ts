// Sign-in rate limiting, record 033. Ten is an order of magnitude below SP
// 800-63B-4 §3.2.2's 100-attempt ceiling; thirty minutes reuses
// SESSION_IDLE_TTL_MS rather than inventing a second unit of time. The
// per-address limit is judgement, not a cited number — see the record.
export const EMAIL_FAILURE_LIMIT = 10;
export const IP_FAILURE_LIMIT = 30;
export const THROTTLE_WINDOW_MS = 30 * 60 * 1000;
export const THROTTLE_LOCK_MS = 30 * 60 * 1000;
