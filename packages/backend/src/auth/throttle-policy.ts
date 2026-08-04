// Sign-in rate limiting. Numbers and rationale: .scratch/decisions/033-throttling-sign-in.md,
// .scratch/decisions/034-the-throttle-under-concurrency.md.
export const EMAIL_FAILURE_LIMIT = 10;
export const IP_FAILURE_LIMIT = 30;
export const THROTTLE_WINDOW_MS = 30 * 60 * 1000;

// Self-service password change (record 065 §2) — a judgement, not a
// derivation, unlike the two limits above.
export const PASSWORD_CHANGE_FAILURE_LIMIT = 5;
