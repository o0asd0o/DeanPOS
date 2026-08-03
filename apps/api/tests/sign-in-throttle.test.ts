import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";

import * as passwordModule from "backend/src/common/password.ts";
import { hashPassword } from "backend/src/common/password.ts";
import {
  EMAIL_FAILURE_LIMIT,
  IP_FAILURE_LIMIT,
  THROTTLE_WINDOW_MS,
} from "backend/src/auth/throttle-policy.ts";
import { createDb } from "backend/src/db/client.ts";
import { seedTenantUser } from "../src/seed-tenant-user.ts";
import { createTestSeam } from "../src/test-seam.ts";

// Record 033. This file pins the unproxied case — no X-Forwarded-For, so
// every request lands in the "ip:no-forwarded-for" bucket, which is what the
// per-address assertions are about. It clears that key before and after.
const seam = createTestSeam({ clientIp: null });
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });
const IP_KEY = "ip:no-forwarded-for";

const tenantId = randomUUID();
const userId = randomUUID();
const email = `throttle-${randomUUID()}@sign-in.test`;
const password = "correct horse battery staple";

const clearIpKey = () => ownerDb.deleteFrom("SignInThrottle").where("key", "=", IP_KEY).execute();
const emailKeyFor = (address: string) => `email:${address.trim().toLowerCase()}`;
const clearEmailKey = (address: string) =>
  ownerDb.deleteFrom("SignInThrottle").where("key", "=", emailKeyFor(address)).execute();

// "date" legitimately differs between two responses issued a moment apart,
// so its value is normalised to a sentinel — but the header's presence (or
// absence) still has to match, so it stays in the compared set.
const sortedHeaderEntries = (headers: Headers | null) =>
  Array.from(headers ?? [])
    .map(([key, value]): [string, string] => [key, key.toLowerCase() === "date" ? "<date>" : value])
    .sort(([a], [b]) => a.localeCompare(b));

async function failNTimes(targetEmail: string, count: number) {
  for (let i = 0; i < count; i++) {
    await seam.actors.signIn(targetEmail, "definitely wrong");
  }
}

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Throttle Tenant" }).execute();
  await seedTenantUser(ownerDb, {
    id: userId,
    tenantId,
    email,
    passwordHash: await hashPassword(password),
    mustChangePassword: false,
    role: "admin",
  });
  await clearIpKey();
});

afterAll(async () => {
  await clearIpKey();
  await clearEmailKey(email);
  await ownerDb.deleteFrom("Session").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("id", "=", userId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("sign-in throttling — per email", () => {
  it("refuses an existing and a non-existing address identically after the threshold, in the same test", async () => {
    const unknownEmail = `nobody-${randomUUID()}@sign-in.test`;
    await clearEmailKey(email);
    await clearEmailKey(unknownEmail);
    await clearIpKey();

    await failNTimes(email, EMAIL_FAILURE_LIMIT);
    await failNTimes(unknownEmail, EMAIL_FAILURE_LIMIT);

    // Locked now: even the *correct* password for the real account is
    // refused with the same shape as before — the lock, not the password,
    // is doing the refusing.
    const knownLocked = await seam.actors.signIn(email, password);
    const unknownLocked = await seam.actors.signIn(unknownEmail, "irrelevant");
    // A third, unthrottled cause — the seeded account's own address with a
    // wrong password — completes issue 03 criterion 5's three-way
    // comparison against a real account, not a second unknown one.
    await clearEmailKey(email);
    const wrongPassword = await seam.actors.signIn(email, "definitely wrong");
    await clearEmailKey(email);

    expect(knownLocked.result).toStrictEqual({ ok: false });
    expect(unknownLocked.result).toStrictEqual({ ok: false });
    expect(wrongPassword.result).toStrictEqual({ ok: false });
    expect(knownLocked.setCookie).toBeNull();
    expect(unknownLocked.setCookie).toBeNull();
    expect(wrongPassword.setCookie).toBeNull();

    // Same status and headers too — the throttle lock, a wrong password,
    // and an unknown email must be one indistinguishable HTTP response.
    expect(knownLocked.status).toBe(wrongPassword.status);
    expect(unknownLocked.status).toBe(wrongPassword.status);
    expect(sortedHeaderEntries(knownLocked.headers)).toStrictEqual(
      sortedHeaderEntries(wrongPassword.headers),
    );
    expect(sortedHeaderEntries(unknownLocked.headers)).toStrictEqual(
      sortedHeaderEntries(wrongPassword.headers),
    );

    await clearEmailKey(email);
    await clearEmailKey(unknownEmail);
    await clearIpKey();
  }, 30_000);

  it("increments the failure counter for an email that matches no User", async () => {
    const unknownEmail = `nobody-${randomUUID()}@sign-in.test`;
    await clearEmailKey(unknownEmail);
    await clearIpKey();

    await seam.actors.signIn(unknownEmail, "irrelevant");

    const row = await ownerDb
      .selectFrom("SignInThrottle")
      .selectAll()
      .where("key", "=", emailKeyFor(unknownEmail))
      .executeTakeFirstOrThrow();
    expect(row.failures).toBe(1);

    await clearEmailKey(unknownEmail);
    await clearIpKey();
  });

  it("a throttled request never reaches the password hash", async () => {
    const lockedEmail = `locked-${randomUUID()}@sign-in.test`;
    await clearEmailKey(lockedEmail);
    await clearIpKey();

    await failNTimes(lockedEmail, EMAIL_FAILURE_LIMIT);

    const spy = vi.spyOn(passwordModule, "verifyPassword");
    const result = await seam.actors.signIn(lockedEmail, "any password at all");
    expect(result.result).toStrictEqual({ ok: false });
    expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();

    await clearEmailKey(lockedEmail);
    await clearIpKey();
  }, 30_000);

  it("a lock lifts by itself after the configured period, and success clears that address's counter", async () => {
    const liftEmail = `lift-${randomUUID()}@sign-in.test`;
    const liftUserId = randomUUID();
    await seedTenantUser(ownerDb, {
      id: liftUserId,
      tenantId,
      email: liftEmail,
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
      role: "cashier",
    });
    await clearEmailKey(liftEmail);
    await clearIpKey();

    await failNTimes(liftEmail, EMAIL_FAILURE_LIMIT);
    const stillLocked = await seam.actors.signIn(liftEmail, password);
    expect(stillLocked.result).toStrictEqual({ ok: false });

    // Simulate the window's expiry rather than waiting thirty real minutes
    // — the next reservation's staleness check resets the counter (034).
    await ownerDb
      .updateTable("SignInThrottle")
      .set({ updated_at: new Date(Date.now() - THROTTLE_WINDOW_MS - 1000) })
      .where("key", "=", emailKeyFor(liftEmail))
      .execute();

    const afterLift = await seam.actors.signIn(liftEmail, password);
    expect(afterLift.result).toStrictEqual({ ok: true, mustChangePassword: false });

    const row = await ownerDb
      .selectFrom("SignInThrottle")
      .selectAll()
      .where("key", "=", emailKeyFor(liftEmail))
      .executeTakeFirst();
    expect(row).toBeUndefined();

    await clearIpKey();
    await ownerDb.deleteFrom("Session").where("user_id", "=", liftUserId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", liftUserId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", liftUserId).execute();
  }, 30_000);
});

describe("sign-in throttling — per client address", () => {
  it("refuses repeated failures from one address independently of the per-address account, and an unforwarded request is throttled rather than exempted", async () => {
    await clearIpKey();
    // Speeds up the volume run: these are all genuine failures (wrong
    // password), the mock only removes the real scrypt cost of proving it.
    vi.spyOn(passwordModule, "verifyPassword").mockResolvedValue(false);

    for (let i = 0; i < IP_FAILURE_LIMIT; i++) {
      const attemptEmail = `ip-spray-${randomUUID()}@sign-in.test`;
      await seam.actors.signIn(attemptEmail, "irrelevant");
      await clearEmailKey(attemptEmail); // isolate: only the ip key should carry state
    }
    vi.restoreAllMocks();

    // A brand-new email, never seen before, with the real correct
    // password for a real account — still refused, purely on the shared
    // "no forwarded address" bucket having crossed its own limit.
    const freshResult = await seam.actors.signIn(email, password);
    expect(freshResult.result).toStrictEqual({ ok: false });
    expect(freshResult.setCookie).toBeNull();

    const row = await ownerDb
      .selectFrom("SignInThrottle")
      .selectAll()
      .where("key", "=", IP_KEY)
      .executeTakeFirstOrThrow();
    expect(row.failures).toBeGreaterThan(IP_FAILURE_LIMIT);

    await clearIpKey();
    await clearEmailKey(email);
  }, 60_000);
});

describe("sign-in throttling — concurrency (record 034)", () => {
  it("reserves before the hash, so concurrent attempts cannot all reach verifyPassword", async () => {
    const raceEmail = `race-${randomUUID()}@sign-in.test`;
    await clearEmailKey(raceEmail);
    await clearIpKey();

    const spy = vi.spyOn(passwordModule, "verifyPassword");
    const attemptCount = EMAIL_FAILURE_LIMIT + 10;
    // Fired together, not awaited one at a time — this is what exposes the
    // race: every attempt starts before any of them has written its result.
    await Promise.all(
      Array.from({ length: attemptCount }, () => seam.actors.signIn(raceEmail, "definitely wrong")),
    );

    expect(spy.mock.calls.length).toBeLessThanOrEqual(EMAIL_FAILURE_LIMIT);
    vi.restoreAllMocks();

    await clearEmailKey(raceEmail);
    await clearIpKey();
  }, 30_000);

  it("a successful sign-in decrements the IP key rather than clearing it", async () => {
    const releaseEmail = `release-${randomUUID()}@sign-in.test`;
    const releaseUserId = randomUUID();
    await seedTenantUser(ownerDb, {
      id: releaseUserId,
      tenantId,
      email: releaseEmail,
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
      role: "cashier",
    });
    await clearEmailKey(releaseEmail);
    await clearIpKey();

    vi.spyOn(passwordModule, "verifyPassword").mockResolvedValue(false);
    for (let i = 0; i < 5; i++) {
      const attemptEmail = `ip-baseline-${randomUUID()}@sign-in.test`;
      await seam.actors.signIn(attemptEmail, "irrelevant");
      await clearEmailKey(attemptEmail);
    }
    vi.restoreAllMocks();

    const before = await ownerDb
      .selectFrom("SignInThrottle")
      .selectAll()
      .where("key", "=", IP_KEY)
      .executeTakeFirstOrThrow();

    const result = await seam.actors.signIn(releaseEmail, password);
    expect(result.result).toStrictEqual({ ok: true, mustChangePassword: false });

    // Decremented back to its prior value, not deleted — clearing and
    // releasing are indistinguishable from the handler's return, so this
    // has to read the stored row directly (record 034).
    const after = await ownerDb
      .selectFrom("SignInThrottle")
      .selectAll()
      .where("key", "=", IP_KEY)
      .executeTakeFirstOrThrow();
    expect(after.failures).toBe(before.failures);

    await clearIpKey();
    await ownerDb.deleteFrom("Session").where("user_id", "=", releaseUserId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", releaseUserId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", releaseUserId).execute();
  }, 30_000);
});
