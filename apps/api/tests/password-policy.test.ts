import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { hashPassword } from "backend/src/common/password.ts";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "backend/src/auth/password-policy.ts";
import { createDb } from "backend/src/db/client.ts";
import { seedTenantUser } from "../src/seed-tenant-user.ts";
import { createTestSeam } from "../src/test-seam.ts";

// Record 032, amended 2026-08-03: eight characters minimum, 128 maximum, at both
// places a password is created. Sign-in never enforces the minimum — see
// sign-in.test.ts and the non-ASCII round-trip below.
const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const userId = randomUUID();
const email = `password-policy-${randomUUID()}@sign-in.test`;
const temporaryPassword = "temporary-password-1";

const platformAdminId = randomUUID();
const provisionedTenantIds: string[] = [];

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Password Policy Tenant" })
    .execute();
  await seedTenantUser(ownerDb, {
    id: userId,
    tenantId,
    email,
    passwordHash: await hashPassword(temporaryPassword),
    role: "admin",
  });
  await ownerDb
    .insertInto("PlatformAdmin")
    .values({ id: platformAdminId, email: `platform-admin-${randomUUID()}@deanpos.test` })
    .execute();
});

afterAll(async () => {
  if (provisionedTenantIds.length > 0) {
    await ownerDb.deleteFrom("UserRole").where("tenant_id", "in", provisionedTenantIds).execute();
    await ownerDb.deleteFrom("User").where("tenant_id", "in", provisionedTenantIds).execute();
    await ownerDb.deleteFrom("Tenant").where("id", "in", provisionedTenantIds).execute();
  }
  await ownerDb.deleteFrom("PlatformAdmin").where("id", "=", platformAdminId).execute();
  await ownerDb.deleteFrom("Session").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("id", "=", userId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("the password policy on auth.setPassword", () => {
  it("refuses a password shorter than the minimum, leaving the stored hash unchanged", async () => {
    const { client } = await seam.actors.signIn(email, temporaryPassword);
    const before = await ownerDb
      .selectFrom("User")
      .select("password_hash")
      .where("id", "=", userId)
      .executeTakeFirstOrThrow();

    await expect(
      client.auth.setPassword({ newPassword: "a".repeat(PASSWORD_MIN_LENGTH - 1) }),
    ).rejects.toThrow();

    const after = await ownerDb
      .selectFrom("User")
      .select("password_hash")
      .where("id", "=", userId)
      .executeTakeFirstOrThrow();
    expect(after.password_hash).toBe(before.password_hash);
  });

  it("refuses a password longer than the maximum", async () => {
    const { client } = await seam.actors.signIn(email, temporaryPassword);

    await expect(
      client.auth.setPassword({ newPassword: "a".repeat(PASSWORD_MAX_LENGTH + 1) }),
    ).rejects.toThrow();
  });

  it("accepts a password of exactly the minimum length", async () => {
    const { client } = await seam.actors.signIn(email, temporaryPassword);

    await expect(
      client.auth.setPassword({ newPassword: "a".repeat(PASSWORD_MIN_LENGTH) }),
    ).resolves.toStrictEqual({ ok: true });

    // Restore, so later tests in this file still know the current password.
    await ownerDb
      .updateTable("User")
      .set({ must_change_password: true, password_hash: await hashPassword(temporaryPassword) })
      .where("id", "=", userId)
      .execute();
  });
});

describe("the password policy on platformAdmin.provisionTenant", () => {
  it("refuses a password below the minimum — the merged contradiction of record 032", async () => {
    const result = seam.actors
      .asPlatformAdmin(platformAdminId)
      .client.platformAdmin.provisionTenant({
        tenantName: "Should Not Provision",
        adminEmail: `refused-${randomUUID()}@new-restaurant.test`,
        adminPassword: "a".repeat(PASSWORD_MIN_LENGTH - 1),
      });

    await expect(result).rejects.toThrow();

    const leaked = await ownerDb
      .selectFrom("Tenant")
      .selectAll()
      .where("name", "=", "Should Not Provision")
      .execute();
    expect(leaked).toStrictEqual([]);
  });

  it("accepts an admin password of exactly the minimum length", async () => {
    const result = await seam.actors
      .asPlatformAdmin(platformAdminId)
      .client.platformAdmin.provisionTenant({
        tenantName: "Minimum Length Restaurant",
        adminEmail: `owner-${randomUUID()}@new-restaurant.test`,
        adminPassword: "a".repeat(PASSWORD_MIN_LENGTH),
      });

    expect(result).not.toBeNull();
    provisionedTenantIds.push(result!.tenantId);
  });
});

describe("normalisation, one function on both the set path and the verify path", () => {
  it("a non-ASCII password set once is signed in with once, after trimming and a different Unicode form", async () => {
    const nonAsciiUserId = randomUUID();
    const nonAsciiEmail = `non-ascii-${randomUUID()}@sign-in.test`;
    await seedTenantUser(ownerDb, {
      id: nonAsciiUserId,
      tenantId,
      email: nonAsciiEmail,
      passwordHash: await hashPassword(temporaryPassword),
      role: "admin",
    });

    const { client } = await seam.actors.signIn(nonAsciiEmail, temporaryPassword);
    // Combining acute accent + precomposed accents — NFC normalises this
    // to a single canonical byte sequence before hashing.
    const decomposed = "café puerta azul veinte";
    await expect(client.auth.setPassword({ newPassword: decomposed })).resolves.toStrictEqual({
      ok: true,
    });

    // Typed differently — precomposed, with stray surrounding whitespace —
    // but normalises to the same bytes. A divergent normalisation between
    // set and verify would refuse this and lock the account out forever.
    const retyped = `  café puerta azul veinte  `;
    const signedIn = await seam.actors.signIn(nonAsciiEmail, retyped);
    expect(signedIn.result).toStrictEqual({ ok: true, mustChangePassword: false });

    await ownerDb.deleteFrom("Session").where("user_id", "=", nonAsciiUserId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", nonAsciiUserId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", nonAsciiUserId).execute();
  });
});
