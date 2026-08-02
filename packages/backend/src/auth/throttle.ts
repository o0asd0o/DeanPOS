import { clearThrottleKey } from "./db-operations/commands/clear-throttle-key.command.ts";
import { lockThrottleKey } from "./db-operations/commands/lock-throttle-key.command.ts";
import { upsertThrottleFailure } from "./db-operations/commands/upsert-throttle-failure.command.ts";
import { findLockedThrottleKeys } from "./db-operations/queries/find-locked-throttle-keys.query.ts";
import {
  EMAIL_FAILURE_LIMIT,
  IP_FAILURE_LIMIT,
  THROTTLE_LOCK_MS,
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

// The pre-hash check (record 033): touches only this table, never `User`,
// so its cost is identical for an address that exists and one that does not.
export const isThrottled = async (db: DatabaseInstance, keys: ThrottleKeys): Promise<boolean> => {
  const locked = await findLockedThrottleKeys(db, [keys.emailKey, keys.ipKey]);
  return locked.length > 0;
};

const recordFailure = async (db: DatabaseInstance, key: string, limit: number) => {
  const staleBefore = new Date(Date.now() - THROTTLE_WINDOW_MS);
  const failures = await upsertThrottleFailure(db, key, staleBefore);
  if (failures >= limit) {
    await lockThrottleKey(db, key, new Date(Date.now() + THROTTLE_LOCK_MS));
  }
};

// Incremented for every failed sign-in, whether or not the email matches a
// User — counting only real accounts is a perfect enumeration oracle.
export const recordSignInFailure = async (db: DatabaseInstance, keys: ThrottleKeys) => {
  await recordFailure(db, keys.emailKey, EMAIL_FAILURE_LIMIT);
  await recordFailure(db, keys.ipKey, IP_FAILURE_LIMIT);
};

// NIST: "disregard any previous failed attempts" on success. The IP key is
// deliberately left alone — an address that has been spraying should not
// buy back its budget by finally guessing one account right.
export const clearSignInThrottle = (db: DatabaseInstance, keys: ThrottleKeys) =>
  clearThrottleKey(db, keys.emailKey);
