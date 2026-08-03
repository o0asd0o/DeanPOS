import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  PIN_ATTEMPT_WINDOW_MS,
  PIN_LOCK_MS,
  PIN_USER_FAILURE_LIMIT,
  pinLockUntil,
  readPinThrottle,
  recordPinFailure,
  recordPinSuccess,
} from "@/lib/pin-throttle.ts";

// Record 059 Q1/Q2: two counters, either locks; 5 per User, 10 per Device,
// a 2-minute lock, no escalation.
describe("pin-throttle", () => {
  beforeEach(() => localStorage.clear());

  it("starts unlocked with an empty state", () => {
    expect(pinLockUntil(readPinThrottle(), "u1")).toBeNull();
  });

  it("locks a User after 5 consecutive failures, not before", () => {
    for (let i = 0; i < PIN_USER_FAILURE_LIMIT - 1; i++) recordPinFailure("u1");
    expect(pinLockUntil(readPinThrottle(), "u1")).toBeNull();
    recordPinFailure("u1");
    const lockedUntil = pinLockUntil(readPinThrottle(), "u1");
    expect(lockedUntil).not.toBeNull();
    expect(lockedUntil! - Date.now()).toBeLessThanOrEqual(PIN_LOCK_MS);
    expect(lockedUntil! - Date.now()).toBeGreaterThan(PIN_LOCK_MS - 1000);
  });

  it("locks the Device after 10 failures across different Users — switching User does not reset it", () => {
    for (let i = 0; i < 5; i++) recordPinFailure("u1");
    for (let i = 0; i < 5; i++) recordPinFailure("u2");
    expect(pinLockUntil(readPinThrottle(), "u3")).not.toBeNull();
  });

  it("a User's failures do not lock a different User", () => {
    for (let i = 0; i < PIN_USER_FAILURE_LIMIT; i++) recordPinFailure("u1");
    // u1's failures also feed the device counter, but 5 < 10 so the device
    // itself is not locked and an unlocked u2 is unaffected.
    expect(pinLockUntil(readPinThrottle(), "u2")).toBeNull();
  });

  it("a successful unlock zeroes the Device and that User's counter", () => {
    for (let i = 0; i < PIN_USER_FAILURE_LIMIT - 1; i++) recordPinFailure("u1");
    recordPinSuccess("u1");
    const state = readPinThrottle();
    expect(state.device.failures).toBe(0);
    expect(state.users["u1"]).toBeUndefined();
  });

  it("clamps a lock so nothing longer than PIN_LOCK_MS is possible", () => {
    localStorage.setItem(
      "deanpos.pin.throttle",
      JSON.stringify({
        device: { failures: 0, lockedUntil: null, lastAttemptAt: null },
        users: {
          u1: {
            failures: 5,
            lockedUntil: Date.now() + PIN_LOCK_MS * 100,
            lastAttemptAt: Date.now(),
          },
        },
      }),
    );
    expect(pinLockUntil(readPinThrottle(), "u1")).toBeNull();
  });

  it("a lock expiring resets that key's counter to 0 with no escalation", () => {
    localStorage.setItem(
      "deanpos.pin.throttle",
      JSON.stringify({
        device: { failures: 0, lockedUntil: null, lastAttemptAt: null },
        users: {
          u1: { failures: 5, lockedUntil: Date.now() - 1000, lastAttemptAt: Date.now() - 1000 },
        },
      }),
    );
    expect(pinLockUntil(readPinThrottle(), "u1")).toBeNull();
    recordPinFailure("u1");
    expect(readPinThrottle().users["u1"]!.failures).toBe(1);
  });

  it("restarts the counter at 1 once the attempt window has elapsed", () => {
    localStorage.setItem(
      "deanpos.pin.throttle",
      JSON.stringify({
        device: { failures: 0, lockedUntil: null, lastAttemptAt: null },
        users: {
          u1: {
            failures: 3,
            lockedUntil: null,
            lastAttemptAt: Date.now() - PIN_ATTEMPT_WINDOW_MS - 1000,
          },
        },
      }),
    );
    recordPinFailure("u1");
    expect(readPinThrottle().users["u1"]!.failures).toBe(1);
  });

  it("does not count an attempt or advance lastAttemptAt while locked", () => {
    for (let i = 0; i < PIN_USER_FAILURE_LIMIT; i++) recordPinFailure("u1");
    const before = readPinThrottle().users["u1"]!;
    recordPinFailure("u1");
    const after = readPinThrottle().users["u1"]!;
    expect(after.failures).toBe(before.failures);
    expect(after.lastAttemptAt).toBe(before.lastAttemptAt);
  });

  it("returns a fresh empty state on malformed storage", () => {
    localStorage.setItem("deanpos.pin.throttle", "{not json");
    expect(pinLockUntil(readPinThrottle(), "u1")).toBeNull();
  });

  it("locks with no network at all — criterion 3", () => {
    const originalFetch = globalThis.fetch;
    // Proves the throttle never reaches for the network.
    globalThis.fetch = (() => {
      throw new Error("no network in this test");
    }) as typeof fetch;
    try {
      for (let i = 0; i < PIN_USER_FAILURE_LIMIT; i++) recordPinFailure("u1");
      expect(pinLockUntil(readPinThrottle(), "u1")).not.toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
