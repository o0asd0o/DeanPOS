// 30 days is NIST SP 800-63-4 AAL1's stated reauthentication ceiling; 30
// minutes idle is stricter than AAL1/AAL2. Ratified in .scratch/decisions/031.
export const SESSION_IDLE_TTL_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
