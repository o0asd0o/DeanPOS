// On-device PIN lockout (record 059) — not a security boundary, defeated by
// clearing devtools storage; it deters a bystander only (ADR-0007 revokes).
// Fails open: never clears the roster or the Device token, never blocks a sale.
const THROTTLE_KEY = "deanpos.pin.throttle";

export const PIN_USER_FAILURE_LIMIT = 5;
export const PIN_DEVICE_FAILURE_LIMIT = 10;
export const PIN_LOCK_MS = 2 * 60 * 1000;
export const PIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

type Counter = { failures: number; lockedUntil: number | null; lastAttemptAt: number | null };
export type PinThrottleState = { device: Counter; users: Record<string, Counter> };

const emptyCounter = (): Counter => ({ failures: 0, lockedUntil: null, lastAttemptAt: null });
const emptyState = (): PinThrottleState => ({ device: emptyCounter(), users: {} });

const isFiniteOrNull = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isFinite(value));

function isCounter(value: unknown): value is Counter {
  if (typeof value !== "object" || value === null) return false;
  const { failures, lockedUntil, lastAttemptAt } = value as Record<string, unknown>;
  return (
    typeof failures === "number" &&
    Number.isFinite(failures) &&
    isFiniteOrNull(lockedUntil) &&
    isFiniteOrNull(lastAttemptAt)
  );
}

function isValidState(value: unknown): value is PinThrottleState {
  if (typeof value !== "object" || value === null) return false;
  const { device, users } = value as Record<string, unknown>;
  if (!isCounter(device)) return false;
  if (typeof users !== "object" || users === null || Array.isArray(users)) return false;
  return Object.values(users).every(isCounter);
}

// Any invalid field or storage-access error returns a fresh empty state —
// a single corrupt entry must not take the till out of service (record 059).
export const readPinThrottle = (): PinThrottleState => {
  try {
    const raw = localStorage.getItem(THROTTLE_KEY);
    if (!raw) return emptyState();
    const parsed: unknown = JSON.parse(raw);
    return isValidState(parsed) ? parsed : emptyState();
  } catch {
    return emptyState();
  }
};

// A full or denied store must not block a sale (record 059's fail-open rule).
const writePinThrottle = (state: PinThrottleState): void => {
  try {
    localStorage.setItem(THROTTLE_KEY, JSON.stringify(state));
  } catch {
    /* fails open */
  }
};

// The invariant record 059 calls the most important line: no stored value or
// clock change may produce a lock longer than PIN_LOCK_MS.
const clampLockedUntil = (lockedUntil: number | null): number | null => {
  if (lockedUntil === null) return null;
  const remaining = lockedUntil - Date.now();
  if (remaining <= 0) return null;
  return remaining > PIN_LOCK_MS ? null : lockedUntil;
};

const activeLock = (counter: Counter): number | null => clampLockedUntil(counter.lockedUntil);

// The later of the two locks, or null if neither is in force.
export const pinLockUntil = (state: PinThrottleState, userId: string): number | null => {
  const deviceLock = activeLock(state.device);
  const userLock = activeLock(state.users[userId] ?? emptyCounter());
  if (deviceLock === null) return userLock;
  if (userLock === null) return deviceLock;
  return Math.max(deviceLock, userLock);
};

function advance(counter: Counter, limit: number): Counter {
  if (activeLock(counter) !== null) return counter;
  const now = Date.now();
  // A lock that just expired is a fresh budget, never escalation — its
  // failures reset to 0 even if lastAttemptAt is still within the window.
  const hadExpiredLock = counter.lockedUntil !== null;
  const withinWindow =
    !hadExpiredLock &&
    counter.lastAttemptAt !== null &&
    now - counter.lastAttemptAt <= PIN_ATTEMPT_WINDOW_MS;
  const failures = (withinWindow ? counter.failures : 0) + 1;
  const lockedUntil = failures >= limit ? now + PIN_LOCK_MS : null;
  return { failures, lockedUntil, lastAttemptAt: now };
}

// Either applicable lock in force refuses the whole attempt — neither
// counter advances (035's never-opening window, refused at design time).
export const recordPinFailure = (userId: string): void => {
  const state = readPinThrottle();
  const userCounter = state.users[userId] ?? emptyCounter();
  if (activeLock(state.device) !== null || activeLock(userCounter) !== null) return;
  const device = advance(state.device, PIN_DEVICE_FAILURE_LIMIT);
  const user = advance(userCounter, PIN_USER_FAILURE_LIMIT);
  const users = { ...state.users, [userId]: user };
  writePinThrottle({ device, users });
};

// A successful unlock zeroes both counters and clears every lock, not only
// the succeeding User's.
export const recordPinSuccess = (userId: string): void => {
  const state = readPinThrottle();
  const users = Object.fromEntries(
    Object.entries(state.users).filter(
      ([id, counter]) => id !== userId && activeLock(counter) === null,
    ),
  );
  writePinThrottle({ device: emptyCounter(), users });
};
