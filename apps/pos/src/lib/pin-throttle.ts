// On-device PIN lockout (record 059). Not a security boundary — devtools
// clears it and 057 concedes the roster grinds in ~75s. It exists against a
// bystander; revocation (ADR-0007) is the mitigation. Fails open: never
// clears the roster or the Device token, never blocks a sale.
const THROTTLE_KEY = "deanpos.pin.throttle";

export const PIN_USER_FAILURE_LIMIT = 5;
export const PIN_DEVICE_FAILURE_LIMIT = 10;
export const PIN_LOCK_MS = 2 * 60 * 1000;
export const PIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

type Counter = { failures: number; lockedUntil: number | null; lastAttemptAt: number | null };
export type PinThrottleState = { device: Counter; users: Record<string, Counter> };

const emptyCounter = (): Counter => ({ failures: 0, lockedUntil: null, lastAttemptAt: null });
const emptyState = (): PinThrottleState => ({ device: emptyCounter(), users: {} });

export const readPinThrottle = (): PinThrottleState => {
  const raw = localStorage.getItem(THROTTLE_KEY);
  if (!raw) return emptyState();
  try {
    return JSON.parse(raw) as PinThrottleState;
  } catch {
    return emptyState();
  }
};

const writePinThrottle = (state: PinThrottleState): void => {
  localStorage.setItem(THROTTLE_KEY, JSON.stringify(state));
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

export const recordPinFailure = (userId: string): void => {
  const state = readPinThrottle();
  const device = advance(state.device, PIN_DEVICE_FAILURE_LIMIT);
  const user = advance(state.users[userId] ?? emptyCounter(), PIN_USER_FAILURE_LIMIT);
  const users = { ...state.users, [userId]: user };
  writePinThrottle({ device, users });
};

// A successful unlock zeroes both counters and clears every lock.
export const recordPinSuccess = (userId: string): void => {
  const state = readPinThrottle();
  const users = { ...state.users };
  delete users[userId];
  writePinThrottle({ device: emptyCounter(), users });
};
