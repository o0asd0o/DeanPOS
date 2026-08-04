import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";

import * as passwordModule from "backend/src/common/password.ts";
import { hashPassword, verifyPassword } from "backend/src/common/password.ts";
import { PASSWORD_CHANGE_FAILURE_LIMIT } from "backend/src/auth/throttle-policy.ts";
import { createDb } from "backend/src/db/client.ts";
import { seedTenantUser } from "../src/seed-tenant-user.ts";
import { createTestSeam } from "../src/test-seam.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const password = "correct horse battery staple";

async function seedUser(options: { mustChangePassword?: boolean } = {}) {
  const userId = randomUUID();
  const email = `change-password-${randomUUID()}@sign-in.test`;
  await seedTenantUser(ownerDb, {
    id: userId,
    tenantId,
    email,
    passwordHash: await hashPassword(password),
    mustChangePassword: options.mustChangePassword ?? false,
    role: "admin",
  });
  return { userId, email };
}

const clearKey = (userId: string) =>
  ownerDb.deleteFrom("SignInThrottle").where("key", "=", `pwchange:${userId}`).execute();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Change Password Tenant" })
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("Session").where("tenant_id", "=", tenantId).execute();
  const ownUsers = await ownerDb
    .selectFrom("User")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .execute();
  await ownerDb
    .deleteFrom("SignInThrottle")
    .where(
      "key",
      "in",
      ownUsers.map(({ id }) => `pwchange:${id}`),
    )
    .execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("auth.changePassword", () => {
  it("a signed-in User changes their own password and stays signed in afterwards", async () => {
    const { email } = await seedUser();
    const { client } = await seam.actors.signIn(email, password);

    const result = await client.auth.changePassword({
      currentPassword: password,
      newPassword: "a brand new password",
    });
    expect(result).toStrictEqual({ ok: true });

    await expect(client.auth.me()).resolves.toMatchObject({ authenticated: true });
  });

  it("a wrong current password returns wrong-current-password and does not change the stored hash", async () => {
    const { userId, email } = await seedUser();
    const { client } = await seam.actors.signIn(email, password);

    const result = await client.auth.changePassword({
      currentPassword: "definitely wrong",
      newPassword: "a different new password",
    });
    expect(result).toStrictEqual({ ok: false, reason: "wrong-current-password" });

    const row = await ownerDb
      .selectFrom("User")
      .select("password_hash")
      .where("id", "=", userId)
      .executeTakeFirstOrThrow();
    expect(await verifyPassword(password, row.password_hash)).toBe(true);

    await clearKey(userId);
  });

  it("the sixth wrong attempt throttles on pwchange:<userId>, and a failed change never burns the sign-in budget", async () => {
    const { userId, email } = await seedUser();
    await clearKey(userId);

    const emailKey = `email:${email.trim().toLowerCase()}`;
    const ipKey = `ip:${seam.clientIp}`;
    const readThrottle = (key: string) =>
      ownerDb.selectFrom("SignInThrottle").selectAll().where("key", "=", key).executeTakeFirst();

    for (let i = 0; i < PASSWORD_CHANGE_FAILURE_LIMIT; i++) {
      const { client } = await seam.actors.signIn(email, password);
      const beforeEmail = await readThrottle(emailKey);
      const beforeIp = await readThrottle(ipKey);

      const attempt = await client.auth.changePassword({
        currentPassword: "wrong",
        newPassword: "a different new password",
      });
      expect(attempt).toStrictEqual({ ok: false, reason: "wrong-current-password" });

      // Asserted directly on sign-in's own rows, not inferred from a later
      // sign-in succeeding: a failed change must not touch email:/ip:.
      expect((await readThrottle(emailKey))?.failures).toBe(beforeEmail?.failures);
      expect((await readThrottle(ipKey))?.failures).toBe(beforeIp?.failures);
    }

    const { client } = await seam.actors.signIn(email, password);
    const sixth = await client.auth.changePassword({
      currentPassword: "wrong",
      newPassword: "a different new password",
    });
    expect(sixth).toStrictEqual({ ok: false, reason: "throttled" });

    await clearKey(userId);
  });

  it("a successful change clears the throttle key; a failed one leaves the reservation standing", async () => {
    const { userId, email } = await seedUser();
    await clearKey(userId);

    const { client: failClient } = await seam.actors.signIn(email, password);
    await failClient.auth.changePassword({
      currentPassword: "wrong",
      newPassword: "a different new password",
    });
    const afterFailure = await ownerDb
      .selectFrom("SignInThrottle")
      .selectAll()
      .where("key", "=", `pwchange:${userId}`)
      .executeTakeFirstOrThrow();
    expect(afterFailure.failures).toBe(1);

    const { client: successClient } = await seam.actors.signIn(email, password);
    const result = await successClient.auth.changePassword({
      currentPassword: password,
      newPassword: "a brand new password",
    });
    expect(result).toStrictEqual({ ok: true });

    const afterSuccess = await ownerDb
      .selectFrom("SignInThrottle")
      .selectAll()
      .where("key", "=", `pwchange:${userId}`)
      .executeTakeFirst();
    expect(afterSuccess).toBeUndefined();
  });

  it("reserves before the hash, so concurrent wrong attempts cannot all pass a pre-increment read", async () => {
    const { userId, email } = await seedUser();
    await clearKey(userId);

    const attemptCount = PASSWORD_CHANGE_FAILURE_LIMIT + 10;
    const sessions = await Promise.all(
      Array.from({ length: attemptCount }, () => seam.actors.signIn(email, password)),
    );

    // The spy starts only now — sign-in above already made its own
    // verifyPassword calls, which are not what this test measures.
    const spy = vi.spyOn(passwordModule, "verifyPassword");
    await Promise.all(
      sessions.map(({ client }) =>
        client.auth.changePassword({ currentPassword: "wrong", newPassword: "a new password xyz" }),
      ),
    );

    expect(spy.mock.calls.length).toBeLessThanOrEqual(PASSWORD_CHANGE_FAILURE_LIMIT);
    vi.restoreAllMocks();

    await clearKey(userId);
  }, 30_000);

  it("a policy-invalid newPassword is refused before any hash comparison and burns no attempt", async () => {
    const { userId, email } = await seedUser();
    await clearKey(userId);

    const { client } = await seam.actors.signIn(email, password);
    const spy = vi.spyOn(passwordModule, "verifyPassword");

    await expect(
      client.auth.changePassword({ currentPassword: password, newPassword: "short" }),
    ).rejects.toThrow();

    expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();

    const row = await ownerDb
      .selectFrom("SignInThrottle")
      .selectAll()
      .where("key", "=", `pwchange:${userId}`)
      .executeTakeFirst();
    expect(row).toBeUndefined();
  });

  it("a successful change revokes the User's other live sessions and keeps the caller's", async () => {
    const { email } = await seedUser();
    const other = await seam.actors.signIn(email, password);
    const caller = await seam.actors.signIn(email, password);

    const result = await caller.client.auth.changePassword({
      currentPassword: password,
      newPassword: "a session-revoking new password",
    });
    expect(result).toStrictEqual({ ok: true });

    await expect(other.client.auth.me()).resolves.toStrictEqual({ authenticated: false });
    await expect(caller.client.auth.me()).resolves.toMatchObject({ authenticated: true });
  });

  it("refuses with reason: refused when mustChangePassword is set — the middleware exempts this path, so this guard is the only enforcement", async () => {
    const { email } = await seedUser({ mustChangePassword: true });
    const { client } = await seam.actors.signIn(email, password);

    const result = await client.auth.changePassword({
      currentPassword: password,
      newPassword: "a forced-flow new password",
    });
    expect(result).toStrictEqual({ ok: false, reason: "refused" });
  });

  it("both write paths go through updateUserPassword: a self-service change also clears must_change_password", async () => {
    const { userId, email } = await seedUser();
    const { client } = await seam.actors.signIn(email, password);

    await client.auth.changePassword({
      currentPassword: password,
      newPassword: "another brand new password",
    });

    const row = await ownerDb
      .selectFrom("User")
      .select("must_change_password")
      .where("id", "=", userId)
      .executeTakeFirstOrThrow();
    expect(row.must_change_password).toBe(false);
  });
});
