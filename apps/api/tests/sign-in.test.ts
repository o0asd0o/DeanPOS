import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { seedTenantUser } from "../src/seed-tenant-user.ts";
import { createTestSeam } from "../src/test-seam.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const userId = randomUUID();
const email = `admin-${randomUUID()}@sign-in.test`;
const password = "correct horse battery staple";

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Sign-in Tenant" }).execute();
  await seedTenantUser(ownerDb, {
    id: userId,
    tenantId,
    email,
    passwordHash: await hashPassword(password),
    mustChangePassword: false,
    role: "admin",
  });
});

afterAll(async () => {
  await ownerDb.deleteFrom("Session").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("id", "=", userId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("auth.signIn", () => {
  it("signs in with the correct email and password", async () => {
    const { result } = await seam.actors.signIn(email, password);

    expect(result).toStrictEqual({ ok: true, mustChangePassword: false });
  });

  it("sets a persistent, httpOnly, Secure, SameSite=Lax cookie scoped to the registrable domain", async () => {
    const { setCookie } = await seam.actors.signIn(email, password);

    expect(setCookie).toBeTruthy();
    const cookie = setCookie!;
    expect(cookie).toMatch(/^deanpos_session=[^;]+/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Domain=\.deanpos\.test/i);
    // Persistent, with an explicit expiry — not a session cookie.
    expect(cookie).toMatch(/Expires=/i);
    expect(cookie).toMatch(/Max-Age=\d+/i);
  });

  it("never returns the session id in the response body", async () => {
    const { result } = await seam.actors.signIn(email, password);

    expect(JSON.stringify(result)).not.toContain("Session");
    expect(Object.keys(result)).toStrictEqual(["ok", "mustChangePassword"]);
  });

  it("the resulting session client reaches a tenant-scoped procedure as this Tenant", async () => {
    const { client } = await seam.actors.signIn(email, password);

    const store = await client.store.get({ id: randomUUID() });
    expect(store).toBeNull(); // no Store by that id, but reached the procedure as this Tenant, not refused outright
  });

  it("a wrong password is refused with the exact same message and shape as an unknown email", async () => {
    const wrongPassword = await seam.actors.signIn(email, "not the password");
    const unknownEmail = await seam.actors.signIn(`nobody-${randomUUID()}@sign-in.test`, password);

    expect(wrongPassword.result).toStrictEqual({ ok: false });
    expect(unknownEmail.result).toStrictEqual({ ok: false });
    expect(wrongPassword.setCookie).toBeNull();
    expect(unknownEmail.setCookie).toBeNull();
  });

  it("timing: an unknown email costs about what a wrong password costs (one scrypt verification either way)", async () => {
    const time = async (attempt: () => Promise<unknown>) => {
      const start = performance.now();
      await attempt();
      return performance.now() - start;
    };

    const wrongPasswordMs = await time(() => seam.actors.signIn(email, "not the password"));
    const unknownEmailMs = await time(() =>
      seam.actors.signIn(`nobody-${randomUUID()}@sign-in.test`, password),
    );

    // Both pay one scrypt verification; the difference should be far smaller
    // than either duration, not a near-zero vs. full-cost split.
    const ratio =
      Math.max(wrongPasswordMs, unknownEmailMs) / Math.min(wrongPasswordMs, unknownEmailMs);
    expect(ratio).toBeLessThan(3);
  });

  it("refuses a deactivated User with the same shape", async () => {
    const deactivatedId = randomUUID();
    const deactivatedEmail = `deactivated-${randomUUID()}@sign-in.test`;
    await ownerDb
      .insertInto("User")
      .values({
        id: deactivatedId,
        tenant_id: tenantId,
        email: deactivatedEmail,
        password_hash: await hashPassword(password),
        must_change_password: false,
        role: "cashier",
        active: false,
      })
      .execute();

    const { result } = await seam.actors.signIn(deactivatedEmail, password);
    expect(result).toStrictEqual({ ok: false });

    await ownerDb.deleteFrom("User").where("id", "=", deactivatedId).execute();
  });

  it("wrong-tenant probe: sign-in never leaks whether an email belongs to another Tenant", async () => {
    const otherEmail = `other-tenant-${randomUUID()}@sign-in.test`;
    const { result } = await seam.actors.signIn(otherEmail, "irrelevant");
    expect(result).toStrictEqual({ ok: false });
  });

  // Issue 04, round 1 finding 1: the live gate authorises from UserRole, and
  // absence is a refusal — never a fallback to User.role.
  it("a User with no UserRole row is refused, even though sign-in itself succeeds", async () => {
    const noHistoryId = randomUUID();
    const noHistoryEmail = `no-history-${randomUUID()}@sign-in.test`;
    await ownerDb
      .insertInto("User")
      .values({
        id: noHistoryId,
        tenant_id: tenantId,
        email: noHistoryEmail,
        password_hash: await hashPassword(password),
        must_change_password: false,
        role: "admin",
        active: true,
      })
      .execute();

    const { result, client } = await seam.actors.signIn(noHistoryEmail, password);
    expect(result).toStrictEqual({ ok: true, mustChangePassword: false });
    await expect(client.auth.me()).resolves.toStrictEqual({ authenticated: false });

    await ownerDb.deleteFrom("Session").where("user_id", "=", noHistoryId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", noHistoryId).execute();
  });
});
