import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";

import * as passwordModule from "backend/src/common/password.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { EMAIL_FAILURE_LIMIT, IP_FAILURE_LIMIT } from "backend/src/auth/throttle-policy.ts";
import { createDb } from "backend/src/db/client.ts";
import { createTestSeam } from "../src/test-seam.ts";

// Record 033: keyed on the submitted email string and the client address,
// checked before the hash, and the refusal is byte-identical to a wrong
// password. The test seam's fetch never sets X-Forwarded-For, so every
// request in this whole suite shares the "ip:no-forwarded-for" bucket —
// this file clears it before and after so it never pollutes, or is
// polluted by, another test file.
const seam = createTestSeam();
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

async function failNTimes(targetEmail: string, count: number) {
  for (let i = 0; i < count; i++) {
    await seam.actors.signIn(targetEmail, "definitely wrong");
  }
}

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Throttle Tenant" }).execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: userId,
      tenant_id: tenantId,
      email,
      password_hash: await hashPassword(password),
      must_change_password: false,
      role: "admin",
      active: true,
    })
    .execute();
  await clearIpKey();
});

afterAll(async () => {
  await clearIpKey();
  await clearEmailKey(email);
  await ownerDb.deleteFrom("Session").where("tenant_id", "=", tenantId).execute();
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

    expect(knownLocked.result).toStrictEqual({ ok: false });
    expect(unknownLocked.result).toStrictEqual({ ok: false });
    expect(knownLocked.setCookie).toBeNull();
    expect(unknownLocked.setCookie).toBeNull();

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
    await ownerDb
      .insertInto("User")
      .values({
        id: liftUserId,
        tenant_id: tenantId,
        email: liftEmail,
        password_hash: await hashPassword(password),
        must_change_password: false,
        role: "cashier",
        active: true,
      })
      .execute();
    await clearEmailKey(liftEmail);
    await clearIpKey();

    await failNTimes(liftEmail, EMAIL_FAILURE_LIMIT);
    const stillLocked = await seam.actors.signIn(liftEmail, password);
    expect(stillLocked.result).toStrictEqual({ ok: false });

    // Simulate the lock's expiry rather than waiting thirty real minutes.
    await ownerDb
      .updateTable("SignInThrottle")
      .set({ locked_until: new Date(Date.now() - 1000) })
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
    expect(row.locked_until).not.toBeNull();

    await clearIpKey();
    await clearEmailKey(email);
  }, 60_000);
});
