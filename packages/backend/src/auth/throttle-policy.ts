// Sign-in rate limiting. Numbers and rationale: .scratch/decisions/033-throttling-sign-in.md.
export const EMAIL_FAILURE_LIMIT = 10;
export const IP_FAILURE_LIMIT = 30;
export const THROTTLE_WINDOW_MS = 30 * 60 * 1000;
export const THROTTLE_LOCK_MS = 30 * 60 * 1000;
