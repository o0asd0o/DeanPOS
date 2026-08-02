// No lifetime is specified anywhere; a number had to be picked to satisfy
// acceptance criteria 4 and 5 — flagged in this issue's `## Comments`.
export const SESSION_IDLE_TTL_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
