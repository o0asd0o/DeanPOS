import { clearThrottleKey } from "./db-operations/commands/clear-throttle-key.command.ts";
import { releaseThrottleReservation } from "./db-operations/commands/release-throttle-reservation.command.ts";
import { upsertThrottleFailure } from "./db-operations/commands/upsert-throttle-failure.command.ts";
import {
  EMAIL_FAILURE_LIMIT,
  IP_FAILURE_LIMIT,
  PASSWORD_CHANGE_FAILURE_LIMIT,
  THROTTLE_WINDOW_MS,
} from "./throttle-policy.ts";
import type { DatabaseInstance } from "../db/client.ts";

export type ThrottleKeys = { emailKey: string; ipKey: string };

// Keyed on the submitted email string, never a found User row — the
// opposite is an account-enumeration oracle (record 033).
export const throttleKeys = (email: string, clientIp: string): ThrottleKeys => ({
  emailKey: `email:${email.trim().toLowerCase()}`,
  ipKey: `ip:${clientIp}`,
});

// Record 034: the reservation is the check. Both keys are incremented in
// one atomic statement each before the hash, so two concurrent requests
// cannot both read a pre-increment count and both proceed to it.
export const reserveSignInAttempt = async (
  db: DatabaseInstance,
  keys: ThrottleKeys,
): Promise<boolean> => {
  const staleBefore = new Date(Date.now() - THROTTLE_WINDOW_MS);
  const [emailFailures, ipFailures] = await Promise.all([
    upsertThrottleFailure(db, keys.emailKey, staleBefore),
    upsertThrottleFailure(db, keys.ipKey, staleBefore),
  ]);
  return emailFailures > EMAIL_FAILURE_LIMIT || ipFailures > IP_FAILURE_LIMIT;
};

// Record 034: undoes this request's own reservation on success. Never a
// clear — every other recorded failure on either key stands.
export const releaseSignInThrottle = (db: DatabaseInstance, keys: ThrottleKeys) =>
  Promise.all([
    releaseThrottleReservation(db, keys.emailKey),
    releaseThrottleReservation(db, keys.ipKey),
  ]);

// NIST: "disregard any previous failed attempts" on success. Only the
// email key is cleared — an address that has been spraying should not buy
// back its IP budget by finally guessing one account right (record 033).
export const clearSignInThrottle = (db: DatabaseInstance, keys: ThrottleKeys) =>
  clearThrottleKey(db, keys.emailKey);

// Self-service password change (record 065 §2): keyed on the caller's own
// `userId`, never sign-in's `email:`/`ip:` — a failed change must not burn
// the sign-in budget. Same reserve-before-hash/release/clear machinery.
export const passwordChangeThrottleKey = (userId: string): string => `pwchange:${userId}`;

export const reservePasswordChangeAttempt = async (
  db: DatabaseInstance,
  key: string,
): Promise<boolean> => {
  const staleBefore = new Date(Date.now() - THROTTLE_WINDOW_MS);
  const failures = await upsertThrottleFailure(db, key, staleBefore);
  return failures > PASSWORD_CHANGE_FAILURE_LIMIT;
};

export const releasePasswordChangeThrottle = (db: DatabaseInstance, key: string) =>
  releaseThrottleReservation(db, key);

export const clearPasswordChangeThrottle = (db: DatabaseInstance, key: string) =>
  clearThrottleKey(db, key);
